export const WORKOUT_PLAN_TEMPLATES = {
  Push: {
    title: "Suggested Push Day",
    description: "Top 5 based on your current pressing pattern: chest press, incline, shoulders, side delts, triceps. Push-ups/pec fly stay optional.",
    exercises: [
      weightedExercise("Flat Dumbbell Bench Press", [set("7", "40"), set("7", "40"), set("8", "40")], "Hold 40s until you can get 3x10 clean; drop to 35s if form breaks."),
      weightedExercise("Incline Dumbbell Press", [set("7", "35"), set("7", "35"), set("7", "35")], "Build this to 3x10 before increasing."),
      weightedExercise("Dumbbell Shoulder Press", [set("10", "30"), set("10", "30"), set("10", "30")], "If tired, make this 2 sets and keep reps clean."),
      weightedExercise("Lateral Raise", [set("15", "15"), set("15", "15"), set("15", "15")], "No recent log; start strict. Increase only after 20,20,20 without swinging."),
      weightedExercise("Triceps Rope Pushdown", [set("10", "37.5"), set("10", "37.5"), set("10", "37.5")], "Use full lockout and controlled return.")
    ]
  },
  Pull: {
    title: "Suggested Pull Day",
    description: "Vertical pull + one horizontal row + rear delts + biceps. Avoid default Low Row + DB Row overlap.",
    exercises: [
      weightedExercise("Lat Pulldown", [set("10", "120"), set("10", "120"), set("8", "120")], "Progress when you can hit 12,12,12 clean."),
      weightedExercise("Low Row", [set("12", "120"), set("12", "120"), set("10", "120")], "Choose this instead of DB rows for stable progression."),
      weightedExercise("Machine Rear Delt", [set("15", "60"), set("15", "60"), set("12", "60")], "Start controlled; move 50-70 depending on the machine."),
      weightedExercise("Bicep Curl", [set("10", "30"), set("8", "30"), set("7", "30")], "Do not swing. Progress to 10,10,10 before increasing."),
      weightedExercise("Hammer Curl", [set("12", "25"), set("10", "25"), set("10", "25")], "Start slightly below bicep curl and keep wrists neutral.")
    ]
  },
  Legs: {
    title: "Suggested Leg Day",
    description: "Your current repeatable leg work: quad isolation, squat pattern, hamstring curl, hinge, calves.",
    exercises: [
      weightedExercise("Leg Extension", [set("10", "145"), set("10", "130"), set("10", "130")], "You have hit 145; use back-off sets if the first set is hard."),
      weightedExercise("Goblet Squats", [set("10", "50"), set("10", "50"), set("10", "50")], "Controlled depth; progress reps before weight."),
      weightedExercise("Leg Curls", [set("12", "115"), set("12", "115"), set("12", "115")], "Verify same machine/setup if this suddenly feels much harder."),
      weightedExercise("Romanian Deadlift", [set("10", "50"), set("10", "50"), set("10", "50")], "Hinge, soft knees, slow negative. Treat as per-dumbbell if that is how you log it."),
      weightedExercise("Calf Raise", [set("12", "90"), set("12", "90"), set("12", "90")], "Use full stretch and pause at the top; adjust if using a different calf machine.")
    ]
  }
};

export function buildSuggestedPlanForSplit(split) {
  const key = canonicalSplit(split);
  const template = WORKOUT_PLAN_TEMPLATES[key];
  if (!template) return null;
  return structuredClone(template);
}

export function shouldShowSuggestedPlan({ plan, hiddenSplits }) {
  if (!plan?.exercises?.length) return false;
  if (hiddenSplits?.has?.(canonicalSplitFromTitle(plan.title))) return false;
  return true;
}

export function suggestedPlanDraftStorageKey(date, split) {
  return `fitness-suggested-plan-draft:${date}:${canonicalSplit(split) || "none"}`;
}

export function suggestedPlanHiddenStorageKey(date) {
  return `fitness-suggested-plan-hidden:${date}`;
}

function canonicalSplitFromTitle(title) {
  const normalized = String(title || "").toLowerCase();
  if (normalized.includes("push")) return "Push";
  if (normalized.includes("pull")) return "Pull";
  if (normalized.includes("leg")) return "Legs";
  return "";
}

export function canonicalSplit(split) {
  const normalized = String(split || "").trim().toLowerCase();
  if (normalized === "push") return "Push";
  if (normalized === "pull") return "Pull";
  if (normalized === "leg" || normalized === "legs") return "Legs";
  return "";
}

function weightedExercise(name, sets, note) {
  return { name, trackingType: "weighted", sets, note };
}

function set(reps, weight) {
  return { reps, weight, duration: "" };
}
