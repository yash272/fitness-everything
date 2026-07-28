export function hasWorkoutActivity(workout) {
  return Boolean(workout?.exercises?.some((exercise) => exercise.exercise_sets?.length));
}

export function workoutTypeForEdit(workout) {
  return workout?.split?.trim() || "";
}

export function workoutTypeLabel(split) {
  return split?.trim() || "";
}

export function toggleWorkoutType(currentSplit, nextSplit) {
  const current = workoutTypeLabel(currentSplit);
  const next = workoutTypeLabel(nextSplit);
  return current.toLowerCase() === next.toLowerCase() ? "" : next;
}

export function workoutActivityFlag(split, workout) {
  return Boolean(workoutTypeLabel(split) || hasWorkoutActivity(workout));
}

export function workoutStageLabel(split, workout) {
  return workoutActivityFlag(split, workout) ? "Active session" : "Rest day";
}

export function workoutStatusLabel(workout) {
  if (!hasWorkoutActivity(workout)) return "Rest";
  return workoutTypeLabel(workout.split) || "Workout";
}
