import { buildProgressivePlanForSplit, canonicalSplit } from "./workoutPlan.js";

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function latestMatchingExercise(workouts, split, selectedDate, exerciseName) {
  return workouts
    .filter((workout) => (
      workout.workout_date < selectedDate &&
      canonicalSplit(workout.split) === split
    ))
    .slice()
    .sort((a, b) => b.workout_date.localeCompare(a.workout_date))
    .map((workout) => ({
      date: workout.workout_date,
      exercise: (workout.exercises || []).find(
        (candidate) => normalizeName(candidate.name) === normalizeName(exerciseName)
      )
    }))
    .find((entry) => entry.exercise?.exercise_sets?.length);
}

function exerciseKey(name) {
  return normalizeName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildStrengthSessionDraft({ split, selectedDate, workouts = [] }) {
  const category = canonicalSplit(split);
  const plan = buildProgressivePlanForSplit({ split: category, selectedDate, workouts });
  if (!category || !plan) return null;

  return {
    split: category,
    selectedDate,
    exercises: plan.exercises.map((exercise) => {
      const previous = latestMatchingExercise(workouts, category, selectedDate, exercise.name);
      return {
        key: exerciseKey(exercise.name),
        name: exercise.name,
        trackingType: exercise.trackingType || "weighted",
        previousDate: previous?.date || null,
        previousSets: (previous?.exercise.exercise_sets || [])
          .slice()
          .sort((a, b) => String(a.logged_at || "").localeCompare(String(b.logged_at || "")))
          .map((set) => ({
            ...set,
            reps: set.reps === null ? null : Number(set.reps),
            weight: set.weight === null ? null : Number(set.weight)
          })),
        sets: exercise.sets.map((set) => ({
          id: null,
          reps: String(set.reps ?? ""),
          weight: String(set.weight ?? ""),
          duration: String(set.duration ?? ""),
          is_pr: false
        })),
        progression: exercise.progression
      };
    })
  };
}

export function pairedSetRows(previousSets = [], currentSets = []) {
  return Array.from(
    { length: Math.max(previousSets.length, currentSets.length) },
    (_item, index) => ({
      previous: previousSets[index] || null,
      current: currentSets[index] || null
    })
  );
}

export function findNextIncompleteExerciseIndex(exercises, currentIndex) {
  if (!exercises.length) return -1;
  for (let offset = 1; offset <= exercises.length; offset += 1) {
    const index = (currentIndex + offset) % exercises.length;
    if ((exercises[index].sets || []).some((set) => !set.id)) return index;
  }
  return currentIndex;
}

export function sessionDraftStorageKey(date, split) {
  return `fitness-session-draft-v1:${date}:${canonicalSplit(split) || "none"}`;
}
