export function normalizeExerciseName(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function trackingTypeForSet(exercise, set) {
  const trackingType = exercise?.trackingType || exercise?.tracking_type || "weighted";
  if (trackingType === "weighted" && exercise?.isCustom && !set?.weight) return "bodyweight";
  return trackingType;
}

export function canConfirmSet(set, trackingType = "weighted", isCustom = false) {
  if (!set) return false;
  if (trackingType === "bodyweight") return Boolean(set.reps);
  if (trackingType === "weighted" && isCustom) return Boolean(set.reps);
  return Boolean(set.weight && set.reps);
}
