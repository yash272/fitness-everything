export function normalizeExerciseNameForRecords(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isBetterSet(candidate, currentBest, trackingType = "weighted") {
  if (!candidate) return false;
  if (!currentBest) return true;

  if (trackingType === "time") {
    return Number(candidate.duration_minutes || 0) > Number(currentBest.duration_minutes || 0);
  }

  if (trackingType === "bodyweight") {
    return Number(candidate.reps || 0) > Number(currentBest.reps || 0);
  }

  const candidateWeight = Number(candidate.weight || 0);
  const bestWeight = Number(currentBest.weight || 0);
  return candidateWeight > bestWeight || (candidateWeight === bestWeight && Number(candidate.reps || 0) > Number(currentBest.reps || 0));
}

export function bestSetForExercise({ workouts = [], exerciseName, trackingType = "weighted", selectedDate, excludeSetId = null }) {
  const exerciseKey = normalizeExerciseNameForRecords(exerciseName);
  let best = null;

  workouts.forEach((workout) => {
    if (!workout?.workout_date || workout.workout_date > selectedDate) return;

    (workout.exercises || []).forEach((exercise) => {
      if (normalizeExerciseNameForRecords(exercise.name) !== exerciseKey) return;
      const type = exercise.tracking_type || "weighted";
      if (type !== trackingType) return;

      (exercise.exercise_sets || []).forEach((set) => {
        if (excludeSetId && set.id === excludeSetId) return;
        const candidate = { ...set, date: workout.workout_date };
        if (isBetterSet(candidate, best, trackingType)) best = candidate;
      });
    });
  });

  return best;
}

export function applyPersonalRecordFlags(sets = [], baselineBest = null, trackingType = "weighted") {
  let rollingBest = baselineBest;
  return sets.map((set) => {
    const isPr = Boolean(rollingBest) && isBetterSet(set, rollingBest, trackingType);
    const next = { ...set, is_pr: isPr };
    if (isBetterSet(set, rollingBest, trackingType)) rollingBest = set;
    return next;
  });
}
