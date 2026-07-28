export function hasWorkoutActivity(workout) {
  return Boolean(workout?.exercises?.some((exercise) => exercise.exercise_sets?.length));
}

export function workoutTypeForEdit(workout) {
  return workout?.split?.trim() || "";
}

export function workoutTypeLabel(split) {
  return split?.trim() || "";
}

export function workoutStatusLabel(workout) {
  if (!hasWorkoutActivity(workout)) return "Rest";
  return workoutTypeLabel(workout.split) || "Workout";
}
