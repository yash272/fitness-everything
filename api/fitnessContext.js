const WORKOUT_SELECT = "id,user_id,workout_date,split,did_workout,steps,created_at,updated_at,exercises(id,user_id,name,tracking_type,created_at,exercise_sets(id,user_id,reps,weight,duration_minutes,is_pr,logged_at))";
const BODY_SELECT = "id,user_id,log_date,weight";
const FOOD_SELECT = "id,user_id,log_date,description,calories,logged_at,created_at,updated_at";

function dateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function hasWorkoutActivity(workout) {
  return Boolean(workout?.did_workout || workout?.split || workout?.exercises?.length);
}


export function normalizeDaysParam(value) {
  const parsed = Number.parseInt(value ?? "90", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 90;
  return Math.min(parsed, 180);
}

function sortByDateAscending(items, field) {
  return [...items].sort((a, b) => String(a[field] || "").localeCompare(String(b[field] || "")));
}

function workoutForDay(workout) {
  if (!workout) {
    return {
      did_workout: false,
      type: null,
      exercises: []
    };
  }

  return {
    did_workout: hasWorkoutActivity(workout),
    type: workout.split || null,
    exercises: (workout.exercises || []).map((exercise) => ({
      name: exercise.name,
      tracking_type: exercise.tracking_type || "weighted",
      sets: (exercise.exercise_sets || [])
        .slice()
        .sort((a, b) => String(a.logged_at || "").localeCompare(String(b.logged_at || "")))
        .map((set) => ({
          reps: set.reps,
          weight_lbs: set.weight == null ? null : Number(set.weight),
          duration_minutes: set.duration_minutes == null ? null : Number(set.duration_minutes),
          is_pr: Boolean(set.is_pr),
          logged_at: set.logged_at
        }))
    }))
  };
}

function compactDay(date, { workoutsByDate, bodyLogsByDate, foodLogsByDate }) {
  const workout = workoutsByDate.get(date);
  const bodyLog = bodyLogsByDate.get(date);
  const foodEntries = (foodLogsByDate.get(date) || [])
    .slice()
    .sort((a, b) => String(a.logged_at || "").localeCompare(String(b.logged_at || "")));

  return {
    date,
    steps: workout?.steps ?? null,
    weight_kg: bodyLog ? Number(bodyLog.weight) : null,
    calories_total: foodEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0),
    food_entries: foodEntries.map((entry) => ({
      description: entry.description,
      calories: Number(entry.calories),
      logged_at: entry.logged_at
    })),
    workout: workoutForDay(workout)
  };
}

function groupByDate(items, field) {
  return items.reduce((map, item) => {
    if (!item[field]) return map;
    const current = map.get(item[field]) || [];
    current.push(item);
    map.set(item[field], current);
    return map;
  }, new Map());
}

export function buildFitnessContextPayload({ workouts = [], bodyLogs = [], foodLogs = [], days, generatedAt, startDate, endDate }) {
  const workoutsByDate = new Map(workouts.map((workout) => [workout.workout_date, workout]));
  const bodyLogsByDate = new Map(bodyLogs.map((entry) => [entry.log_date, entry]));
  const foodLogsByDate = groupByDate(foodLogs, "log_date");
  const allDates = new Set([
    ...workouts.map((workout) => workout.workout_date),
    ...bodyLogs.map((entry) => entry.log_date),
    ...foodLogs.map((entry) => entry.log_date)
  ].filter(Boolean));

  const dayRows = [...allDates]
    .filter((date) => date >= startDate && date <= endDate)
    .sort()
    .map((date) => compactDay(date, { workoutsByDate, bodyLogsByDate, foodLogsByDate }));

  const sortedBodyLogs = sortByDateAscending(bodyLogs.filter((entry) => entry.log_date >= startDate && entry.log_date <= endDate), "log_date");
  const firstWeight = sortedBodyLogs[0] ? Number(sortedBodyLogs[0].weight) : null;
  const latestWeight = sortedBodyLogs.at(-1) ? Number(sortedBodyLogs.at(-1).weight) : null;
  const totalCalories = dayRows.reduce((sum, day) => sum + day.calories_total, 0);
  const calorieDays = dayRows.filter((day) => day.calories_total > 0).length;

  return {
    generated_at: generatedAt,
    app: "fitness everything",
    purpose: "LLM fitness context for recent gym, food, weight, and activity questions.",
    period: {
      days,
      start_date: startDate,
      end_date: endDate
    },
    units: {
      body_weight: "kg",
      set_weight: "lbs",
      time: "minutes",
      calories: "kcal"
    },
    summary: {
      workout_days: dayRows.filter((day) => day.workout.did_workout).length,
      total_steps: dayRows.reduce((sum, day) => sum + (Number(day.steps) || 0), 0),
      latest_weight_kg: latestWeight,
      weight_change_kg: firstWeight == null || latestWeight == null ? null : Number((latestWeight - firstWeight).toFixed(1)),
      total_calories_logged: totalCalories,
      average_logged_calories: calorieDays ? Math.round(totalCalories / calorieDays) : null,
      calorie_log_days: calorieDays
    },
    days: dayRows
  };
}

export async function fetchFitnessContext({ supabase, userId, days = 90, now = new Date() }) {
  const endDate = dateKey(now);
  const startDate = dateKey(addUtcDays(now, -(days - 1)));

  const [workoutResult, bodyResult, foodResult] = await Promise.all([
    supabase
      .from("workouts")
      .select(WORKOUT_SELECT)
      .eq("user_id", userId)
      .gte("workout_date", startDate)
      .lte("workout_date", endDate)
      .order("workout_date", { ascending: true }),
    supabase
      .from("body_logs")
      .select(BODY_SELECT)
      .eq("user_id", userId)
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .order("log_date", { ascending: true }),
    supabase
      .from("food_logs")
      .select(FOOD_SELECT)
      .eq("user_id", userId)
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .order("log_date", { ascending: true })
      .order("logged_at", { ascending: true })
  ]);

  const error = workoutResult.error || bodyResult.error || foodResult.error;
  if (error) throw error;

  return buildFitnessContextPayload({
    workouts: workoutResult.data || [],
    bodyLogs: bodyResult.data || [],
    foodLogs: foodResult.data || [],
    days,
    generatedAt: now.toISOString(),
    startDate,
    endDate
  });
}
