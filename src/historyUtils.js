import { hasWorkoutActivity } from "./workoutDisplayUtils.js";
import { canonicalSplit } from "./workoutPlan.js";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function historyCategory(workout) {
  if (!hasWorkoutActivity(workout)) return "Rest";
  return canonicalSplit(workout?.split) || "Activity";
}

export function recentHistoryItems(workouts, filter = "All", limit = 30) {
  return workouts
    .filter((workout) => filter === "All" || historyCategory(workout) === filter)
    .slice()
    .sort((a, b) => b.workout_date.localeCompare(a.workout_date))
    .slice(0, limit);
}

export function consistencySummary(workouts, today = new Date()) {
  const end = dateKey(today);
  const monthStart = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const weekStart = new Date(today);
  const day = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - day + 1);
  const weekStartKey = dateKey(weekStart);

  return workouts.reduce((summary, workout) => {
    if (!hasWorkoutActivity(workout) || workout.workout_date > end) return summary;
    if (workout.workout_date >= monthStart) summary.month += 1;
    if (workout.workout_date >= weekStartKey) summary.week += 1;
    return summary;
  }, { week: 0, month: 0 });
}

export function periodProgress(workouts, startDate, endDate) {
  return workouts.reduce((summary, workout) => {
    if (workout.workout_date < startDate || workout.workout_date > endDate) return summary;
    if (hasWorkoutActivity(workout)) summary.workoutDays += 1;
    return summary;
  }, { workoutDays: 0 });
}

export function formatDailySteps(steps) {
  const value = Number(steps);
  if (!Number.isFinite(value) || value <= 0) return "—";
  const compact = Math.round(value / 100) / 10;
  return `${compact.toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
}
