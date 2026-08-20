import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomExerciseFromHistory,
  buildStrengthSessionDraft,
  exerciseHistoryOptions,
  findNextIncompleteExerciseIndex,
  nextActiveExerciseIndexAfterConfirmation,
  orderSessionExercises,
  pairedSetRows,
  removeSetAtIndex,
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

  assert.equal(draft.exercises.length, 6);
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


test("draft matches bodyweight push-up history across common spellings", () => {
  const draft = buildStrengthSessionDraft({
    split: "Push",
    selectedDate: "2026-07-29",
    workouts: [{
      workout_date: "2026-07-27",
      split: "Push",
      exercises: [{
        name: "Push Ups",
        tracking_type: "bodyweight",
        exercise_sets: [
          { id: "push-1", reps: 14, weight: null, logged_at: "2026-07-27T10:00:00Z" },
          { id: "push-2", reps: 11, weight: null, logged_at: "2026-07-27T10:02:00Z" }
        ]
      }]
    }]
  });

  const pushUps = draft.exercises.find((exercise) => exercise.name === "Push-ups");
  assert.equal(pushUps.previousDate, "2026-07-27");
  assert.deepEqual(pushUps.previousSets.map(({ reps, weight }) => ({ reps, weight })), [
    { reps: 14, weight: null },
    { reps: 11, weight: null }
  ]);
});

test("pairedSetRows keeps unmatched rows visible", () => {
  assert.deepEqual(pairedSetRows([{ id: "p1" }, { id: "p2" }], [{ id: "c1" }]), [
    { previous: { id: "p1" }, current: { id: "c1" } },
    { previous: { id: "p2" }, current: null }
  ]);
});

test("removing an unsaved set keeps the remaining draft rows in order", () => {
  const sets = [
    { id: "saved-1", reps: "10" },
    { id: null, reps: "12" },
    { id: null, reps: "8" }
  ];

  assert.deepEqual(removeSetAtIndex(sets, 1), [
    { id: "saved-1", reps: "10" },
    { id: null, reps: "8" }
  ]);
  assert.deepEqual(sets, [
    { id: "saved-1", reps: "10" },
    { id: null, reps: "12" },
    { id: null, reps: "8" }
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


test("completed exercises move below pending exercises", () => {
  const exercises = [
    { key: "bench", sets: [{ id: "saved" }] },
    { key: "push-ups", sets: [{ id: null }] },
    { key: "press", sets: [{ id: "saved" }] }
  ];

  assert.deepEqual(orderSessionExercises(exercises).map((exercise) => exercise.key), [
    "push-ups",
    "bench",
    "press"
  ]);
});

test("new custom exercises can be pinned to the top of the pending list", () => {
  const exercises = [
    { key: "bench", sets: [{ id: null }] },
    { key: "press", sets: [{ id: "saved" }] }
  ];

  assert.deepEqual(orderSessionExercises([{ key: "custom-push-ups", sets: [{ id: null }] }, ...exercises]).map((exercise) => exercise.key), [
    "custom-push-ups",
    "bench",
    "press"
  ]);
});


test("custom exercise history options search across splits before the selected date", () => {
  const options = exerciseHistoryOptions({
    selectedDate: "2026-07-29",
    query: "leg ex",
    workouts: [{
      workout_date: "2026-07-27",
      split: "Legs",
      exercises: [{
        name: "Leg Extension",
        tracking_type: "weighted",
        exercise_sets: [
          { id: "leg-1", reps: 10, weight: 145, logged_at: "2026-07-27T10:00:00Z" },
          { id: "leg-2", reps: 10, weight: 130, logged_at: "2026-07-27T10:02:00Z" }
        ]
      }]
    }, {
      workout_date: "2026-07-30",
      split: "Legs",
      exercises: [{ name: "Leg Extension", tracking_type: "weighted", exercise_sets: [{ id: "future", reps: 12, weight: 200 }] }]
    }]
  });

  assert.equal(options.length, 1);
  assert.equal(options[0].name, "Leg Extension");
  assert.equal(options[0].sourceDate, "2026-07-27");
  assert.equal(options[0].split, "Legs");
  assert.deepEqual(options[0].previousSets.map(({ reps, weight }) => ({ reps, weight })), [
    { reps: 10, weight: 145 },
    { reps: 10, weight: 130 }
  ]);
});

test("custom exercise from history carries previous sets and plus-two targets", () => {
  const option = exerciseHistoryOptions({
    selectedDate: "2026-07-29",
    query: "extension",
    workouts: [{
      workout_date: "2026-07-27",
      split: "Legs",
      exercises: [{
        name: "Leg Extension",
        tracking_type: "weighted",
        exercise_sets: [
          { id: "leg-1", reps: 10, weight: 145, logged_at: "2026-07-27T10:00:00Z" },
          { id: "leg-2", reps: 12, weight: 130, logged_at: "2026-07-27T10:02:00Z" }
        ]
      }]
    }]
  })[0];

  const exercise = buildCustomExerciseFromHistory(option);

  assert.equal(exercise.name, "Leg Extension");
  assert.equal(exercise.isCustom, true);
  assert.equal(exercise.previousDate, "2026-07-27");
  assert.deepEqual(exercise.sets.map(({ reps, weight }) => ({ reps, weight })), [
    { reps: "12", weight: "145" },
    { reps: "7", weight: "135" }
  ]);
  assert.equal(exercise.progression.label, "From 2026-07-27");
});


test("keeps the current exercise open after confirming an unfinished set", () => {
  const exercises = [
    { key: "bench", sets: [{ id: "saved" }, { id: null }] },
    { key: "press", sets: [{ id: null }] }
  ];

  assert.equal(nextActiveExerciseIndexAfterConfirmation(exercises, "bench"), 0);
});

test("moves to the next unfinished exercise only after the current exercise is done", () => {
  const exercises = [
    { key: "press", sets: [{ id: null }] },
    { key: "bench", sets: [{ id: "saved" }, { id: "saved" }] }
  ];

  assert.equal(nextActiveExerciseIndexAfterConfirmation(exercises, "bench"), 0);
});
