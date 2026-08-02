import { buildProgressivePlanForSplit, canonicalSplit, progressBestSet } from "./workoutPlan.js";

function normalizeName(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
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

function normalizePersistedSet(set) {
  return {
    ...set,
    reps: set?.reps === null || set?.reps === undefined || set?.reps === "" ? null : Number(set.reps),
    weight: set?.weight === null || set?.weight === undefined || set?.weight === "" ? null : Number(set.weight),
    duration_minutes: set?.duration_minutes === null || set?.duration_minutes === undefined || set?.duration_minutes === "" ? null : Number(set.duration_minutes)
  };
}

function sortedSets(exercise) {
  return (exercise?.exercise_sets || [])
    .slice()
    .sort((a, b) => String(a.logged_at || "").localeCompare(String(b.logged_at || "")))
    .map(normalizePersistedSet);
}

function setTrackingType(exercise) {
  if (exercise?.tracking_type) return exercise.tracking_type;
  const sets = exercise?.exercise_sets || [];
  if (sets.some((set) => set.duration_minutes !== null && set.duration_minutes !== undefined && set.duration_minutes !== "")) return "time";
  if (sets.every((set) => set.weight === null || set.weight === undefined || set.weight === "")) return "bodyweight";
  return "weighted";
}

function progressHistoricalSet(set, trackingType) {
  if (trackingType === "bodyweight") {
    const reps = Number(set?.reps);
    return { id: null, reps: Number.isFinite(reps) && reps > 0 ? String(reps + 2) : "10", weight: "", duration: "", is_pr: false };
  }
  if (trackingType === "time") {
    const duration = Number(set?.duration_minutes);
    return { id: null, reps: "", weight: "", duration: Number.isFinite(duration) && duration > 0 ? String(duration) : "", is_pr: false };
  }
  const weight = Number(set?.weight);
  const reps = Number(set?.reps);
  if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) {
    const next = progressBestSet({ weight, reps });
    return { id: null, reps: next.reps, weight: next.weight, duration: "", is_pr: false };
  }
  return { id: null, reps: "10", weight: "", duration: "", is_pr: false };
}

export function exerciseHistoryOptions({ workouts = [], selectedDate, query = "", limit = 6 }) {
  const search = normalizeName(query);
  const latestByName = new Map();

  workouts
    .filter((workout) => workout.workout_date < selectedDate)
    .slice()
    .sort((a, b) => b.workout_date.localeCompare(a.workout_date))
    .forEach((workout) => {
      (workout.exercises || []).forEach((exercise) => {
        const key = normalizeName(exercise.name);
        if (!key || latestByName.has(key) || !exercise.exercise_sets?.length) return;
        if (search && !key.includes(search)) return;
        latestByName.set(key, {
          name: exercise.name,
          key: exerciseKey(exercise.name),
          split: canonicalSplit(workout.split) || workout.split || "Workout",
          sourceDate: workout.workout_date,
          trackingType: setTrackingType(exercise),
          previousSets: sortedSets(exercise)
        });
      });
    });

  return Array.from(latestByName.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildCustomExerciseFromHistory(option) {
  const trackingType = option?.trackingType || "weighted";
  const previousSets = option?.previousSets || [];
  return {
    key: `custom-${exerciseKey(option?.name || "exercise")}-${Date.now()}`,
    name: option?.name || "Exercise",
    trackingType,
    isCustom: true,
    previousDate: option?.sourceDate || null,
    previousSets,
    sets: previousSets.length
      ? previousSets.map((set) => progressHistoricalSet(set, trackingType))
      : [{ id: null, reps: "10", weight: "", duration: "", is_pr: false }],
    progression: { label: option?.sourceDate ? `From ${option.sourceDate}` : "Custom" }
  };
}

export function buildStrengthSessionDraft({ split, selectedDate, workouts = [] }) {
  const category = canonicalSplit(split);
  const plan = buildProgressivePlanForSplit({ split: category, selectedDate, workouts });
  if (!category || !plan) return null;

  return {
    split: category,
    selectedDate,
    exerciseOptions: exerciseHistoryOptions({ workouts, selectedDate, query: "", limit: 30 }),
    exercises: plan.exercises.map((exercise) => {
      const previous = latestMatchingExercise(workouts, category, selectedDate, exercise.name);
      return {
        key: exerciseKey(exercise.name),
        name: exercise.name,
        trackingType: exercise.trackingType || "weighted",
        previousDate: previous?.date || null,
        previousSets: sortedSets(previous?.exercise),
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

export function isSessionExerciseComplete(exercise) {
  const sets = exercise?.sets || [];
  return sets.length > 0 && sets.every((set) => set.id);
}

export function orderSessionExercises(exercises = []) {
  const pending = [];
  const done = [];
  exercises.forEach((exercise) => {
    if (isSessionExerciseComplete(exercise)) done.push(exercise);
    else pending.push(exercise);
  });
  return [...pending, ...done];
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
