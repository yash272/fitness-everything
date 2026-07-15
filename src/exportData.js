const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (key) => new Date(`${key}T12:00:00`);

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function workoutTypeForExport(workout) {
  return workout?.split || "";
}

function hasWorkoutActivity(workout) {
  return Boolean(workout?.did_workout || workout?.exercises?.length || workout?.split);
}

function exportDay({ date, workoutsByDate, bodyLogsByDate }) {
  const workout = workoutsByDate.get(date);
  const bodyLog = bodyLogsByDate.get(date);
  return {
    date,
    steps: workout?.steps ?? null,
    weight_kg: bodyLog ? Number(bodyLog.weight) : null,
    body_fat_percent: bodyLog?.body_fat == null ? null : Number(bodyLog.body_fat),
    gym: hasWorkoutActivity(workout),
    workout_type: workoutTypeForExport(workout) || null,
    workouts: (workout?.exercises || []).map((exercise) => ({
      name: exercise.name,
      tracking_type: exercise.tracking_type || "weighted",
      sets: (exercise.exercise_sets || []).map((set) => ({
        reps: set.reps,
        weight_lbs: set.weight == null ? null : Number(set.weight),
        duration_minutes: set.duration_minutes == null ? null : Number(set.duration_minutes),
        is_pr: Boolean(set.is_pr),
        logged_at: set.logged_at
      }))
    }))
  };
}

function daysBetween(startKey, endKey, maps) {
  if (!startKey || !endKey) return [];
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const days = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(exportDay({ date: dateKey(cursor), ...maps }));
  }
  return days;
}

function buildMonthPeriod(month) {
  const start = startOfMonth(month);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return {
    type: "month",
    month: monthKey,
    start_date: dateKey(start),
    end_date: dateKey(end),
    label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  };
}

function buildAllTimePeriod(workouts, bodyLogs) {
  const dates = [
    ...workouts.map((workout) => workout.workout_date),
    ...bodyLogs.map((entry) => entry.log_date)
  ].filter(Boolean).sort();

  return {
    type: "all_time",
    start_date: dates[0] || null,
    end_date: dates.at(-1) || null,
    label: "All time"
  };
}

export function buildFitnessExport({ mode = "month", month = new Date(), workouts = [], bodyLogs = [], userId }) {
  const workoutsByDate = new Map(workouts.map((workout) => [workout.workout_date, workout]));
  const bodyLogsByDate = new Map(bodyLogs.map((entry) => [entry.log_date, entry]));
  const period = mode === "all-time" ? buildAllTimePeriod(workouts, bodyLogs) : buildMonthPeriod(month);

  return {
    exported_at: new Date().toISOString(),
    app: "fitness everything",
    user_id: userId,
    period,
    units: {
      body_weight: "kg",
      set_weight: "lbs",
      time: "minutes"
    },
    days: daysBetween(period.start_date, period.end_date, { workoutsByDate, bodyLogsByDate })
  };
}

export function exportFilename(payload) {
  if (payload.period.type === "all_time") return "fitness-everything-all-time.json";
  return `fitness-everything-${payload.period.month}.json`;
}
