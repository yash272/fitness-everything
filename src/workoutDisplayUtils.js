const STRENGTH_SPLITS = new Set(["push", "pull", "legs"]);

function isStrengthSplit(split) {
  return STRENGTH_SPLITS.has(workoutTypeLabel(split).toLowerCase());
}

export function hasWorkoutActivity(workout) {
  return Boolean(workout?.exercises?.some((exercise) => exercise.exercise_sets?.length));
}

export function timedActivityNames(workout) {
  const names = [];
  (workout?.exercises || []).forEach((exercise) => {
    if ((exercise.tracking_type || "weighted") !== "time") return;
    if (!exercise.exercise_sets?.length) return;
    const name = workoutTypeLabel(exercise.name);
    if (!name) return;
    if (!names.some((item) => item.toLowerCase() === name.toLowerCase())) names.push(name);
  });
  return names;
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

export function splitForTimedActivity(workout, activityName) {
  const current = workoutTypeForEdit(workout);
  return isStrengthSplit(current) ? current : current || workoutTypeLabel(activityName);
}

export function workoutStatusLabel(workout) {
  if (!hasWorkoutActivity(workout)) return "Rest";

  const type = workoutTypeLabel(workout.split);
  const activityNames = timedActivityNames(workout).filter((name) => name.toLowerCase() !== type.toLowerCase());

  if (type && activityNames.length) return `${type} + ${activityNames.join(" + ")}`;
  if (type) return type;
  if (activityNames.length) return activityNames.join(" + ");
  return "Workout";
}
