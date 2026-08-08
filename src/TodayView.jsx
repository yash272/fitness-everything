import { ArrowRight, Dumbbell, Footprints, Scale, Trash2, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { previousDateKey, todayDateKey } from "./appState";
import QuickLogRow from "./QuickLogRow";
import WeightChart from "./WeightChart";
import { buildWeightChartModel } from "./weightChartUtils";
import { estimateFoodCalories } from "./foodCalorieEstimator";
import { hasWorkoutActivity, workoutStatusLabel } from "./workoutDisplayUtils";

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function workoutDaysWithin(workouts, start, end) {
  return workouts.filter((workout) => (
    workout.workout_date >= start &&
    workout.workout_date <= end &&
    hasWorkoutActivity(workout)
  )).length;
}

function startKey(period) {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay() || 7;
    now.setDate(now.getDate() - day + 1);
  } else {
    now.setDate(1);
  }
  return todayDateKey(now);
}

function dayCountLabel(count) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

export default function TodayView({
  bodyLogs,
  foodLogs,
  workouts,
  range,
  setRange,
  onSaveWeight,
  onSaveSteps,
  onSaveFood,
  onDeleteFood,
  onOpenWorkout,
  saving
}) {
  const today = todayDateKey();
  const [weightDate, setWeightDate] = useState(today);
  const [stepsDate, setStepsDate] = useState(previousDateKey());
  const [foodDate, setFoodDate] = useState(today);
  const [foodDescription, setFoodDescription] = useState("");
  const [foodCalories, setFoodCalories] = useState("");
  const [foodCaloriesEdited, setFoodCaloriesEdited] = useState(false);
  const latestBody = bodyLogs.at(-1);
  const todayWorkout = workouts.find((workout) => workout.workout_date === today);
  const weightEntry = bodyLogs.find((entry) => entry.log_date === weightDate);
  const stepsEntry = workouts.find((workout) => workout.workout_date === stepsDate);
  const foodEntriesForDate = (foodLogs || []).filter((entry) => entry.log_date === foodDate);
  const caloriesForDate = foodEntriesForDate.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
  const calorieEstimate = estimateFoodCalories(foodDescription);
  const chartModel = useMemo(() => buildWeightChartModel(bodyLogs, range), [bodyLogs, range]);
  const firstWeight = chartModel.points[0] ? Number(chartModel.points[0].weight) : null;
  const lastWeight = chartModel.points.at(-1) ? Number(chartModel.points.at(-1).weight) : null;
  const change = firstWeight === null || lastWeight === null ? null : lastWeight - firstWeight;
  const setCount = todayWorkout?.exercises?.reduce((sum, exercise) => sum + exercise.exercise_sets.length, 0) || 0;

  async function saveFoodEntry(event) {
    event.preventDefault();
    const saved = await onSaveFood({ date: foodDate, description: foodDescription, calories: foodCalories });
    if (saved) {
      setFoodDescription("");
      setFoodCalories("");
      setFoodCaloriesEdited(false);
    }
  }

  function updateFoodDescription(value) {
    setFoodDescription(value);
    const nextEstimate = estimateFoodCalories(value);
    if (!foodCaloriesEdited) setFoodCalories(nextEstimate ? String(nextEstimate.calories) : "");
  }

  function useCalorieEstimate() {
    if (!calorieEstimate) return;
    setFoodCalories(String(calorieEstimate.calories));
    setFoodCaloriesEdited(false);
  }

  return (
    <div className="today-layout">
      <section className="weight-stage">
        <div className="today-stage-head">
          <div>
            <span>Latest weight</span>
            <strong>{latestBody ? Number(latestBody.weight).toFixed(1) : "--"} <small>kg</small></strong>
            <p>{latestBody ? formatDate(latestBody.log_date) : "No weigh-in yet"}</p>
          </div>
          <div className="segmented segmented-dark" aria-label="Weight range">
            {[30, 60, 90].map((days) => (
              <button type="button" key={days} className={range === days ? "active" : ""} onClick={() => setRange(days)}>
                {days}D
              </button>
            ))}
          </div>
        </div>
        <WeightChart logs={bodyLogs} range={range} />
        <div className="weight-change">
          <span>Change</span>
          <b>{change === null ? "--" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`}</b>
        </div>
      </section>

      <section className="quick-log-band" aria-label="Quick logs">
        <div className="section-kicker"><Scale size={16} /> Daily measures</div>
        <QuickLogRow
          label="Weight"
          unit="kg"
          date={weightDate}
          value={weightEntry?.weight}
          placeholder="75.2"
          step="0.1"
          onDateChange={setWeightDate}
          onCommit={({ date, value }) => onSaveWeight({ date, weight: value })}
          saving={saving}
        />
        <QuickLogRow
          label="Steps"
          unit="steps"
          date={stepsDate}
          value={stepsEntry?.steps}
          placeholder="8500"
          onDateChange={setStepsDate}
          onCommit={({ date, value }) => onSaveSteps({ date, steps: value })}
          saving={saving}
        />
      </section>

      <section className="calorie-card" aria-label="Calorie tracking">
        <div className="section-kicker"><Utensils size={16} /> Calories</div>
        <div className="calorie-summary">
          <div>
            <strong>{caloriesForDate.toLocaleString()}</strong>
            <span>kcal saved for {formatDate(foodDate)}</span>
          </div>
          <input
            type="date"
            value={foodDate}
            max={today}
            onChange={(event) => setFoodDate(event.target.value)}
            aria-label="Food log date"
          />
        </div>
        <form className="calorie-form" onSubmit={saveFoodEntry}>
          <label>
            Food / meal
            <textarea
              value={foodDescription}
              placeholder="Paneer sabzi, 2 rotis, curd..."
              onChange={(event) => updateFoodDescription(event.target.value)}
              rows={2}
            />
          </label>
          <label>
            Calories
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={foodCalories}
              placeholder="650"
              onChange={(event) => {
                setFoodCalories(event.target.value);
                setFoodCaloriesEdited(true);
              }}
            />
          </label>
          <button className="primary" disabled={saving || !foodDescription.trim() || !foodCalories}>Save food</button>
        </form>
        {calorieEstimate ? (
          <button type="button" className="calorie-estimate" onClick={useCalorieEstimate}>
            Estimated {calorieEstimate.calories.toLocaleString()} kcal from {calorieEstimate.matchedItems.join(", ")}
          </button>
        ) : foodDescription.trim() ? (
          <p className="calorie-estimate muted">No estimate yet — add foods like roti, paneer, dal, rice, protein bar, cookie, etc.</p>
        ) : null}
        {foodEntriesForDate.length ? (
          <div className="food-log-list">
            {foodEntriesForDate.map((entry) => (
              <article className="food-log-entry" key={entry.id}>
                <div>
                  <strong>{entry.description}</strong>
                  <span>{Number(entry.calories).toLocaleString()} kcal</span>
                </div>
                <button type="button" className="secondary mini" onClick={() => onDeleteFood(entry.id)} aria-label={`Delete ${entry.description}`}>
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>
        ) : <p className="empty-inline">No food saved for this day yet.</p>}
      </section>

      <button type="button" className="today-session" onClick={() => onOpenWorkout(today)}>
        <span className="session-icon"><Dumbbell size={20} /></span>
        <span>
          <small>Today · {formatDate(today)}</small>
          <strong>{workoutStatusLabel(todayWorkout)}</strong>
          <em>{hasWorkoutActivity(todayWorkout) ? `${setCount} sets logged` : "Open today's workout"}</em>
        </span>
        <ArrowRight size={19} />
      </button>

      <section className="consistency-strip">
        <div>
          <Footprints size={16} />
          <span>This week</span>
          <strong>{dayCountLabel(workoutDaysWithin(workouts, startKey("week"), today))}</strong>
        </div>
        <div>
          <span>This month</span>
          <strong>{dayCountLabel(workoutDaysWithin(workouts, startKey("month"), today))}</strong>
        </div>
      </section>
    </div>
  );
}
