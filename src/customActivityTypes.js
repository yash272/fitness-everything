import { timedActivityNames, workoutTypeForEdit } from "./workoutDisplayUtils.js";
import { canonicalSplit } from "./workoutPlan.js";

const DEFAULT_TYPES = ["Push", "Pull", "Legs", "Legs + Abs", "Cardio", "Sports", "Mobility", "Badminton"];
const storageKey = (userId) => `fitness-custom-activity-types:${userId}`;

export function loadCustomActivityTypes(storage, userId) {
  if (!storage || !userId) return [];
  try {
    const names = JSON.parse(storage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(names) ? names.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim()) : [];
  } catch {
    return [];
  }
}

export function saveCustomActivityType(storage, userId, name) {
  const nextName = String(name || "").trim();
  const current = loadCustomActivityTypes(storage, userId);
  if (!nextName || !storage || !userId) return current;
  if (current.some((item) => item.toLowerCase() === nextName.toLowerCase())) return current;
  const next = [...current, nextName];
  try {
    storage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // The current session can still offer the activity if browser storage is unavailable.
  }
  return next;
}

export function activityTypeOptions(workouts = [], savedTypes = []) {
  const names = new Map();
  const add = (name) => {
    const trimmed = String(name || "").trim();
    if (trimmed && !names.has(trimmed.toLowerCase())) names.set(trimmed.toLowerCase(), trimmed);
  };
  DEFAULT_TYPES.forEach(add);
  workouts.forEach((workout) => {
    const split = workoutTypeForEdit(workout);
    if (!canonicalSplit(split)) add(split);
    timedActivityNames(workout).forEach(add);
  });
  savedTypes.forEach(add);
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
