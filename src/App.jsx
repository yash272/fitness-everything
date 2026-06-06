import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BarChart3, CalendarDays, Dumbbell, Plus, RefreshCw, Scale, Trash2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const SPLITS = ["Push", "Pull", "Legs", "Cardio"];
const DEFAULT_EXERCISES = {
  Push: ["Bench Press", "Incline Dumbbell Press", "Shoulder Press", "Lateral Raise", "Triceps Pushdown"],
  Pull: ["Deadlift", "Pull Up", "Lat Pulldown", "Barbell Row", "Bicep Curl"],
  Legs: ["Squat", "Leg Press", "Romanian Deadlift", "Leg Curl", "Calf Raise"],
  Cardio: ["Treadmill", "Bike", "Rowing", "Stair Climber", "Elliptical"]
};

const todayKey = () => dateKey(new Date());
const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const formatDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function App() {
  if (!isSupabaseConfigured) return <SetupMissing />;

  return <Tracker />;
}

function Tracker() {
  const userId = import.meta.env.VITE_PERSONAL_USER_ID;
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedSplit, setSelectedSplit] = useState("Push");
  const [range, setRange] = useState(30);
  const [workouts, setWorkouts] = useState([]);
  const [bodyLogs, setBodyLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({ name: "", sets: [{ reps: "10", weight: "" }] });
  const [bodyForm, setBodyForm] = useState({ weight: "", bodyFat: "" });
  const [notice, setNotice] = useState("");

  const todayWorkout = useMemo(() => workouts.find((workout) => workout.workout_date === todayKey()), [workouts]);
  const exerciseNames = useMemo(() => {
    const names = new Set(Object.values(DEFAULT_EXERCISES).flat());
    workouts.forEach((workout) => workout.exercises?.forEach((exercise) => names.add(exercise.name)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [workouts]);
  const recentPrs = useMemo(() => {
    const prs = [];
    workouts.forEach((workout) => {
      workout.exercises?.forEach((exercise) => {
        exercise.exercise_sets?.forEach((set) => {
          if (set.is_pr) {
            prs.push({ ...set, exercise: exercise.name, split: workout.split, date: workout.workout_date });
          }
        });
      });
    });
    return prs.sort((a, b) => b.logged_at.localeCompare(a.logged_at)).slice(0, 8);
  }, [workouts]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [workoutResult, bodyResult] = await Promise.all([
      supabase
        .from("workouts")
        .select("id,user_id,workout_date,split,did_workout,steps,created_at,updated_at,exercises(id,user_id,name,created_at,exercise_sets(id,user_id,reps,weight,is_pr,logged_at))")
        .eq("user_id", userId)
        .order("workout_date", { ascending: false })
        .limit(120),
      supabase
        .from("body_logs")
        .select("id,user_id,log_date,weight,body_fat")
        .eq("user_id", userId)
        .order("log_date", { ascending: true })
        .limit(180)
    ]);

    if (workoutResult.error || bodyResult.error) {
      setNotice(workoutResult.error?.message || bodyResult.error?.message || "Could not load data.");
    } else {
      const normalized = workoutResult.data.map((workout) => ({
        ...workout,
        exercises: (workout.exercises || []).map((exercise) => ({
          ...exercise,
          exercise_sets: (exercise.exercise_sets || []).sort((a, b) => a.logged_at.localeCompare(b.logged_at))
        }))
      }));
      setWorkouts(normalized);
      setBodyLogs(bodyResult.data);
      setSelectedSplit(normalized.find((workout) => workout.workout_date === todayKey())?.split || "Push");
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function ensureWorkoutForDate(date = todayKey(), split = selectedSplit, fields = {}) {
    const existing = workouts.find((workout) => workout.workout_date === date);
    if (existing) {
      const patch = { split, ...fields, updated_at: new Date().toISOString() };
      await supabase.from("workouts").update(patch).eq("id", existing.id);
      const updated = { ...existing, ...patch };
      setWorkouts((items) => sortWorkouts(items.map((item) => item.id === existing.id ? updated : item)));
      return updated;
    }

    const { data, error } = await supabase
      .from("workouts")
      .insert({ user_id: userId, workout_date: date, split, ...fields })
      .select("id,user_id,workout_date,split,did_workout,steps,created_at,updated_at,exercises(id,user_id,name,created_at,exercise_sets(id,user_id,reps,weight,is_pr,logged_at))")
      .single();

    if (error) throw error;
    const next = { ...data, exercises: [] };
    setWorkouts((items) => sortWorkouts([next, ...items]));
    return next;
  }

  async function ensureTodayWorkout(split = selectedSplit, fields = {}) {
    return ensureWorkoutForDate(todayKey(), split, fields);
  }

  function bestBefore(exerciseName) {
    let best = null;
    workouts.forEach((workout) => {
      if (workout.workout_date >= todayKey()) return;
      workout.exercises?.forEach((exercise) => {
        if (exercise.name.toLowerCase() !== exerciseName.toLowerCase()) return;
        exercise.exercise_sets?.forEach((set) => {
          const weight = Number(set.weight);
          if (!best || weight > best.weight || (weight === best.weight && set.reps > best.reps)) {
            best = { weight, reps: set.reps, date: workout.workout_date };
          }
        });
      });
    });
    return best;
  }

  async function addExercise(event) {
    event.preventDefault();
    const name = exerciseForm.name.trim();
    const setRowsInput = exerciseForm.sets
      .map((set) => ({ reps: Number(set.reps), weight: Number(set.weight) }))
      .filter((set) => set.reps > 0 && !Number.isNaN(set.weight));
    if (!name || !setRowsInput.length) return;

    setSaving(true);
    setNotice("");
    try {
      const workout = await ensureTodayWorkout(selectedSplit, { did_workout: true });
      const previous = bestBefore(name);

      const { data: exercise, error: exerciseError } = await supabase
        .from("exercises")
        .insert({ workout_id: workout.id, user_id: userId, name })
        .select("id,user_id,name,created_at")
        .single();
      if (exerciseError) throw exerciseError;

      const setRows = setRowsInput.map((set) => ({
        exercise_id: exercise.id,
        user_id: userId,
        reps: set.reps,
        weight: set.weight,
        is_pr: Boolean(previous) && (set.weight > previous.weight || (set.weight === previous.weight && set.reps > previous.reps))
      }));
      const { data: sets, error: setError } = await supabase
        .from("exercise_sets")
        .insert(setRows)
        .select("id,user_id,reps,weight,is_pr,logged_at");
      if (setError) throw setError;

      const nextExercise = { ...exercise, exercise_sets: sets };
      setWorkouts((items) => upsertExercise(items, workout.id, nextExercise));
      setExerciseForm({ name: "", sets: [{ reps: "10", weight: "" }] });
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function repeatSet(exercise) {
    const last = exercise.exercise_sets?.at(-1);
    if (!last) return;
    const previous = bestBefore(exercise.name);
    const weight = Number(last.weight);
    const isPr = Boolean(previous) && (weight > previous.weight || (weight === previous.weight && last.reps > previous.reps));
    setSaving(true);
    const { data, error } = await supabase
      .from("exercise_sets")
      .insert({ exercise_id: exercise.id, user_id: userId, reps: last.reps, weight, is_pr: isPr })
      .select("id,user_id,reps,weight,is_pr,logged_at")
      .single();

    if (error) setNotice(error.message);
    else {
      setWorkouts((items) => items.map((workout) => ({
        ...workout,
        exercises: workout.exercises?.map((item) => item.id === exercise.id
          ? { ...item, exercise_sets: [...item.exercise_sets, data] }
          : item)
      })));
    }
    setSaving(false);
  }

  async function deleteExercise(exerciseId) {
    setSaving(true);
    const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
    if (error) setNotice(error.message);
    else {
      setWorkouts((items) => items.map((workout) => ({
        ...workout,
        exercises: workout.exercises?.filter((exercise) => exercise.id !== exerciseId)
      })));
    }
    setSaving(false);
  }

  async function saveBody(event) {
    event.preventDefault();
    const weight = Number(bodyForm.weight);
    const bodyFat = bodyForm.bodyFat === "" ? null : Number(bodyForm.bodyFat);
    if (!weight || Number.isNaN(weight)) return;

    setSaving(true);
    setNotice("");
    const { data, error } = await supabase
      .from("body_logs")
      .upsert({
        user_id: userId,
        log_date: todayKey(),
        weight,
        body_fat: Number.isNaN(bodyFat) ? null : bodyFat,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,log_date" })
      .select("id,user_id,log_date,weight,body_fat")
      .single();

    if (error) setNotice(error.message);
    else {
      setBodyLogs((items) => [...items.filter((item) => item.log_date !== data.log_date), data].sort((a, b) => a.log_date.localeCompare(b.log_date)));
      setBodyForm({ weight: "", bodyFat: "" });
    }
    setSaving(false);
  }

  async function changeSplit(split) {
    setSelectedSplit(split);
    try {
      await ensureTodayWorkout(split, { did_workout: true });
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function saveDailyLog({ date, didWorkout, split, steps }) {
    setSaving(true);
    setNotice("");
    try {
      await ensureWorkoutForDate(date, split, {
        did_workout: didWorkout,
        steps: steps === "" ? null : Number(steps)
      });
      if (date === todayKey()) setSelectedSplit(split);
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  const workoutSets = todayWorkout?.exercises?.reduce((sum, exercise) => sum + exercise.exercise_sets.length, 0) || 0;
  const todayPrs = todayWorkout?.exercises?.reduce((sum, exercise) => sum + exercise.exercise_sets.filter((set) => set.is_pr).length, 0) || 0;
  const latestBody = bodyLogs.at(-1);
  const weekDays = workoutDaysWithin(workouts, weekStartKey(), todayKey());
  const monthDays = workoutDaysWithin(workouts, monthStartKey(), todayKey());
  const todaySteps = todayWorkout?.steps || 0;

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fitness Everything</p>
          <h1>Track the next set.</h1>
        </div>
        <div className="date-chip">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
      </header>

      <nav className="tabs" aria-label="Primary">
        <button className={activeView === "dashboard" ? "active" : ""} onClick={() => setActiveView("dashboard")}><BarChart3 size={18} />Dashboard</button>
        <button className={activeView === "daily" ? "active" : ""} onClick={() => setActiveView("daily")}><CalendarDays size={18} />Daily</button>
        <button className={activeView === "workout" ? "active" : ""} onClick={() => setActiveView("workout")}><Dumbbell size={18} />Workout</button>
        <button className={activeView === "body" ? "active" : ""} onClick={() => setActiveView("body")}><Scale size={18} />Body</button>
      </nav>

      {notice && <div className="notice">{notice}</div>}
      {loading ? <Shell message="Loading synced data..." compact /> : null}

      {!loading && activeView === "dashboard" && (
        <Dashboard
          workoutSets={workoutSets}
          todayWorkout={todayWorkout}
          todayPrs={todayPrs}
          latestBody={latestBody}
          weekDays={weekDays}
          monthDays={monthDays}
          bodyLogs={bodyLogs}
          range={range}
          setRange={setRange}
          recentPrs={recentPrs}
          todaySteps={todaySteps}
        />
      )}

      {!loading && activeView === "daily" && (
        <DailyView
          workouts={workouts}
          bodyLogs={bodyLogs}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          saveDailyLog={saveDailyLog}
          selectedSplit={selectedSplit}
          saving={saving}
        />
      )}

      {!loading && activeView === "workout" && (
        <WorkoutView
          selectedSplit={selectedSplit}
          changeSplit={changeSplit}
          exerciseForm={exerciseForm}
          setExerciseForm={setExerciseForm}
          addExercise={addExercise}
          exerciseNames={exerciseNames}
          todayWorkout={todayWorkout}
          bestBefore={bestBefore}
          repeatSet={repeatSet}
          deleteExercise={deleteExercise}
          saving={saving}
        />
      )}

      {!loading && activeView === "body" && (
        <BodyView
          bodyForm={bodyForm}
          setBodyForm={setBodyForm}
          saveBody={saveBody}
          bodyLogs={bodyLogs}
          saving={saving}
        />
      )}
    </main>
  );
}

function Dashboard({ workoutSets, todayWorkout, todayPrs, latestBody, weekDays, monthDays, bodyLogs, range, setRange, recentPrs, todaySteps }) {
  return (
    <>
      <section className="stat-grid">
        <Stat label="Today" value={todayWorkout?.did_workout ? todayWorkout.split : "Rest"} detail={todayWorkout?.did_workout ? `${workoutSets} sets - ${todayWorkout.exercises.length} exercises - ${todayPrs} PR sets` : "No gym logged today"} />
        <Stat label="Latest Weight" value={latestBody ? `${Number(latestBody.weight).toFixed(1)} kg` : "-- kg"} detail={latestBody ? `${formatDate(latestBody.log_date)}${latestBody.body_fat ? ` - ${latestBody.body_fat}% body fat` : ""}` : "No weigh-in yet"} />
        <Stat label="Steps Today" value={todaySteps ? todaySteps.toLocaleString() : "--"} detail="Logged on the Daily tab" />
        <Stat label="This Week" value={`${weekDays} days`} detail="Workout days since Monday" />
        <Stat label="This Month" value={`${monthDays} days`} detail="Workout days this month" />
      </section>

      <section className="panel-section">
        <div className="section-head">
          <h2>Weight Trend</h2>
          <div className="segmented">
            {[30, 60, 90].map((days) => <button key={days} className={range === days ? "active" : ""} onClick={() => setRange(days)}>{days}D</button>)}
          </div>
        </div>
        <WeightChart logs={bodyLogs} range={range} />
      </section>

      <section className="panel-section">
        <h2>Recent PRs</h2>
        <div className="list">
          {recentPrs.length ? recentPrs.map((pr) => (
            <div className="row" key={pr.id}>
              <div>
                <strong>{pr.exercise}</strong>
                <span>{formatDate(pr.date)} - {pr.split}</span>
              </div>
              <b>{Number(pr.weight)} lbs x {pr.reps}</b>
            </div>
          )) : <Empty text="Beat a previous weight or rep mark and it will show here." />}
        </div>
      </section>
    </>
  );
}

function DailyView({ workouts, bodyLogs, selectedDate, setSelectedDate, calendarMonth, setCalendarMonth, saveDailyLog, selectedSplit, saving }) {
  const selectedLog = workouts.find((workout) => workout.workout_date === selectedDate);
  const selectedBodyLog = bodyLogs.find((entry) => entry.log_date === selectedDate);
  const [isEditing, setIsEditing] = useState(!selectedLog);
  const [form, setForm] = useState({
    didWorkout: selectedLog?.did_workout || false,
    steps: selectedLog?.steps ?? ""
  });

  useEffect(() => {
    setForm({
      didWorkout: selectedLog?.did_workout || false,
      steps: selectedLog?.steps ?? ""
    });
    setIsEditing(!selectedLog);
  }, [selectedLog, selectedDate]);

  async function submit(event) {
    event.preventDefault();
    const saved = await saveDailyLog({
      date: selectedDate,
      ...form,
      split: selectedLog?.split || selectedSplit || "Push"
    });
    if (saved) setIsEditing(false);
  }

  return (
    <>
      <section className="panel-section">
        <div className="section-head">
          <button className="secondary mini" onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}>Prev</button>
          <h2>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <button className="secondary mini" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>Next</button>
        </div>
        <CalendarGrid
          month={calendarMonth}
          workouts={workouts}
          bodyLogs={bodyLogs}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      </section>

      <section className={`panel-section daily-state ${selectedLog ? "saved" : "unsaved"}`}>
        <div className="section-head">
          <div>
            <h2>{selectedDate === todayKey() ? "Today" : formatLongDate(selectedDate)}</h2>
            <p>{selectedLog ? "Saved day" : "No daily log saved yet"}</p>
          </div>
          {selectedLog && !isEditing ? <button className="secondary mini" onClick={() => setIsEditing(true)}>Edit</button> : null}
        </div>

        {selectedLog && !isEditing ? (
          <div className="saved-day">
            <div>
              <strong>{selectedLog.did_workout ? selectedLog.split : "No Gym"}</strong>
              <span>{dailyMeta(selectedLog, selectedBodyLog)}</span>
            </div>
            <span className="saved-pill">Saved</span>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <div className="toggle-row">
              <button type="button" className={form.didWorkout ? "active" : ""} onClick={() => setForm({ ...form, didWorkout: true })}>Gym</button>
              <button type="button" className={!form.didWorkout ? "active" : ""} onClick={() => setForm({ ...form, didWorkout: false })}>No Gym</button>
            </div>
            <div className="one-field">
              <label>
                Steps
                <input type="number" min="0" inputMode="numeric" value={form.steps} placeholder="8500" onChange={(event) => setForm({ ...form, steps: event.target.value })} />
              </label>
            </div>
            <div className="form-actions">
              {selectedLog ? <button type="button" className="secondary" onClick={() => setIsEditing(false)}>Cancel</button> : null}
              <button className="primary" disabled={saving}><CalendarDays size={18} />{selectedLog ? "Update Day" : "Save Day"}</button>
            </div>
          </form>
        )}
      </section>

      <section className="panel-section">
        <h2>{formatLongDate(selectedDate)} Workouts</h2>
        <DayWorkoutDetails workout={selectedLog} bodyLog={selectedBodyLog} />
      </section>
    </>
  );
}

function DayWorkoutDetails({ workout, bodyLog }) {
  if (!workout && !bodyLog) return <Empty text="No entry saved for this day yet." />;
  if (!workout) {
    return (
      <div className="day-summary rest">
        <strong>Body log</strong>
        <span>{bodyLog ? `${Number(bodyLog.weight).toFixed(1)} kg${bodyLog.body_fat ? ` - ${bodyLog.body_fat}% body fat` : ""}` : "No workout logged"}</span>
      </div>
    );
  }
  if (!workout.did_workout && !workout.exercises?.length) {
    return (
      <div className="day-summary rest">
        <strong>No gym</strong>
        <span>{dailyMeta(workout, bodyLog)}</span>
      </div>
    );
  }

  return (
    <div className="day-detail">
      <div className="day-summary">
        <strong>{workout.split}</strong>
        <span>{dailyMeta(workout, bodyLog)}</span>
      </div>
      {workout.exercises?.length ? workout.exercises.map((exercise) => (
        <article className="mini-exercise" key={exercise.id}>
          <h3>{exercise.name}</h3>
          <div>
            {exercise.exercise_sets.map((set, index) => (
              <span key={set.id}>{index + 1}. {Number(set.weight)} lbs x {set.reps}{set.is_pr ? " PR" : ""}</span>
            ))}
          </div>
        </article>
      )) : <Empty text={workout.split === "Cardio" ? "Cardio day saved. No lift sets logged." : "Gym day saved. No exercise sets logged yet."} />}
    </div>
  );
}

function CalendarGrid({ month, workouts, bodyLogs, selectedDate, setSelectedDate }) {
  const days = calendarDays(month);
  const logsByDate = new Map(workouts.map((workout) => [workout.workout_date, workout]));
  const bodyLogsByDate = new Map(bodyLogs.map((entry) => [entry.log_date, entry]));

  return (
    <div className="calendar">
      {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span className="weekday" key={`${day}-${index}`}>{day}</span>)}
      {days.map((day) => {
        const key = dateKey(day);
        const log = logsByDate.get(key);
        const bodyLog = bodyLogsByDate.get(key);
        const isCurrentMonth = day.getMonth() === month.getMonth();
        const isSaved = Boolean(log || bodyLog);
        const didWorkout = Boolean(log?.did_workout || log?.exercises?.length);
        const hasSteps = Number(log?.steps) > 0;
        return (
          <button
            key={key}
            className={`calendar-day ${isCurrentMonth ? "" : "muted"} ${selectedDate === key ? "selected" : ""} ${isSaved ? "saved" : "unsaved"} ${didWorkout ? "trained" : "rest"}`}
            onClick={() => setSelectedDate(key)}
          >
            <strong>{day.getDate()}</strong>
            <span>{didWorkout ? log.split : isSaved ? "Saved" : hasSteps ? `${Number(log.steps).toLocaleString()}` : ""}</span>
            <small>{bodyLog ? `${Number(bodyLog.weight).toFixed(1)} kg` : ""}</small>
          </button>
        );
      })}
    </div>
  );
}

function WorkoutView({ selectedSplit, changeSplit, exerciseForm, setExerciseForm, addExercise, exerciseNames, todayWorkout, bestBefore, repeatSet, deleteExercise, saving }) {
  function updateSet(index, field, value) {
    setExerciseForm({
      ...exerciseForm,
      sets: exerciseForm.sets.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set)
    });
  }

  function addSetRow() {
    const last = exerciseForm.sets.at(-1) || { reps: "10", weight: "" };
    setExerciseForm({ ...exerciseForm, sets: [...exerciseForm.sets, { ...last }] });
  }

  function removeSetRow(index) {
    setExerciseForm({
      ...exerciseForm,
      sets: exerciseForm.sets.filter((_set, setIndex) => setIndex !== index)
    });
  }

  return (
    <>
      <section className="split-grid">
        {SPLITS.map((split) => <button key={split} className={selectedSplit === split ? "active" : ""} onClick={() => changeSplit(split)}>{split}</button>)}
      </section>

      <form className="panel-section form" onSubmit={addExercise}>
        <h2>Add Exercise</h2>
        <label>
          Exercise
          <input value={exerciseForm.name} list="exercise-options" placeholder="Bench Press" onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} />
          <datalist id="exercise-options">
            {exerciseNames.map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>
        <div className="set-editor">
          {exerciseForm.sets.map((set, index) => (
            <div className="set-input-row" key={index}>
              <span>{index + 1}</span>
              <label>
                Reps
                <input type="number" min="1" inputMode="numeric" value={set.reps} onChange={(event) => updateSet(index, "reps", event.target.value)} />
              </label>
              <label>
                Lbs
                <input type="number" min="0" step="2.5" inputMode="decimal" value={set.weight} placeholder="135" onChange={(event) => updateSet(index, "weight", event.target.value)} />
              </label>
              <button type="button" className="danger icon-only" onClick={() => removeSetRow(index)} disabled={exerciseForm.sets.length === 1} aria-label={`Remove set ${index + 1}`} title={`Remove set ${index + 1}`}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={addSetRow}><Plus size={17} />Add Set</button>
        </div>
        <button className="primary" disabled={saving}><Plus size={18} />Add Exercise</button>
      </form>

      <section className="panel-section">
        <h2>Today's Workout</h2>
        <div className="exercise-list">
          {todayWorkout?.exercises?.length ? todayWorkout.exercises.map((exercise) => {
            const previous = bestBefore(exercise.name);
            const prCount = exercise.exercise_sets.filter((set) => set.is_pr).length;
            return (
              <article className="exercise-card" key={exercise.id}>
                <div className="exercise-head">
                  <div>
                    <h3>{exercise.name}</h3>
                    <p>{previous ? `Previous best: ${previous.weight} lbs x ${previous.reps} on ${formatDate(previous.date)}` : "No previous session yet"}</p>
                  </div>
                  {prCount ? <span className="badge">PR</span> : null}
                </div>
                <div className="sets">
                  {exercise.exercise_sets.map((set, index) => (
                    <div className="set-row" key={set.id}>
                      <span>{index + 1}</span>
                      <b>{Number(set.weight)} lbs x {set.reps}</b>
                      <em>{set.is_pr ? "NEW PR" : ""}</em>
                    </div>
                  ))}
                </div>
                <div className="card-actions">
                  <button className="secondary" onClick={() => repeatSet(exercise)} disabled={saving}><RefreshCw size={17} />Repeat Set</button>
                  <button className="danger" onClick={() => deleteExercise(exercise.id)} disabled={saving} aria-label={`Delete ${exercise.name}`} title={`Delete ${exercise.name}`}><Trash2 size={17} /></button>
                </div>
              </article>
            );
          }) : <Empty text="Choose a split and add your first exercise. The first session becomes your baseline." />}
        </div>
      </section>
    </>
  );
}

function BodyView({ bodyForm, setBodyForm, saveBody, bodyLogs, saving }) {
  return (
    <>
      <form className="panel-section form" onSubmit={saveBody}>
        <h2>Log Body</h2>
        <div className="two-fields">
          <label>
            Weight kg
            <input type="number" min="0" step="0.1" inputMode="decimal" value={bodyForm.weight} placeholder="75.2" onChange={(event) => setBodyForm({ ...bodyForm, weight: event.target.value })} />
          </label>
          <label>
            Body fat %
            <input type="number" min="0" max="80" step="0.1" inputMode="decimal" value={bodyForm.bodyFat} placeholder="18" onChange={(event) => setBodyForm({ ...bodyForm, bodyFat: event.target.value })} />
          </label>
        </div>
        <button className="primary" disabled={saving}><Scale size={18} />Save Today's Log</button>
      </form>

      <section className="panel-section">
        <h2>History</h2>
        <div className="list">
          {bodyLogs.length ? bodyLogs.slice().reverse().slice(0, 30).map((entry) => (
            <div className="row" key={entry.id}>
              <div>
                <strong>{Number(entry.weight).toFixed(1)} kg</strong>
                <span>{formatDate(entry.log_date)}{entry.body_fat ? ` - ${entry.body_fat}% body fat` : ""}</span>
              </div>
              <b>{bodyTrend(entry, bodyLogs)}</b>
            </div>
          )) : <Empty text="Log your first weigh-in to start the trend chart." />}
        </div>
      </section>
    </>
  );
}

function WeightChart({ logs, range }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#141820";
    ctx.fillRect(0, 0, width, height);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range + 1);
    const points = logs.filter((entry) => entry.log_date >= dateKey(cutoff));

    ctx.fillStyle = "#9aa4b2";
    ctx.font = "24px Inter, sans-serif";
    if (points.length < 2) {
      ctx.fillText("Log at least 2 weigh-ins", 28, 68);
      return;
    }

    const weights = points.map((point) => Number(point.weight));
    const min = Math.min(...weights) - 0.5;
    const max = Math.max(...weights) + 0.5;
    const pad = 36;
    const xFor = (index) => pad + (index / (points.length - 1)) * (width - pad * 2);
    const yFor = (value) => height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2);

    ctx.strokeStyle = "#2a303c";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const y = pad + (i / 3) * (height - pad * 2);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(Number(point.weight));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    points.forEach((point, index) => {
      ctx.fillStyle = "#a7f3d0";
      ctx.beginPath();
      ctx.arc(xFor(index), yFor(Number(point.weight)), 6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#cbd3df";
    ctx.font = "22px Inter, sans-serif";
    ctx.fillText(`${max.toFixed(1)} kg`, pad, 28);
    ctx.fillText(`${min.toFixed(1)} kg`, pad, height - 12);
  }, [logs, range]);

  return (
    <div className="chart">
      <canvas ref={canvasRef} width="680" height="360" aria-label="Weight trend chart" />
    </div>
  );
}

function SetupMissing() {
  return (
    <main className="auth">
      <section className="auth-panel">
        <Activity size={36} />
        <h1>Supabase env vars needed</h1>
        <p>Create a `.env.local` file from `.env.example`, then add your Supabase project URL, anon key, and personal user id.</p>
      </section>
    </main>
  );
}

function Stat({ label, value, detail }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function Shell({ message, compact = false }) {
  return <main className={compact ? "shell compact" : "shell"}>{message}</main>;
}

function upsertExercise(workouts, workoutId, exercise) {
  return sortWorkouts(workouts.map((workout) => {
    if (workout.id !== workoutId) return workout;
    return { ...workout, did_workout: true, exercises: [...(workout.exercises || []), exercise] };
  }));
}

function sortWorkouts(workouts) {
  return workouts.slice().sort((a, b) => b.workout_date.localeCompare(a.workout_date));
}

function weekStartKey() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - day);
  return dateKey(now);
}

function monthStartKey() {
  const now = new Date();
  return dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

function workoutDaysWithin(workouts, startDate, endDate) {
  return workouts.filter((workout) => workout.workout_date >= startDate && workout.workout_date <= endDate && (workout.did_workout || workout.exercises?.length)).length;
}

function bodyTrend(entry, logs) {
  const index = logs.findIndex((item) => item.id === entry.id);
  const previous = logs[index - 1];
  if (!previous) return "First";
  const delta = Number(entry.weight) - Number(previous.weight);
  if (Math.abs(delta) < 0.05) return "Even";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`;
}

function dailyMeta(workout, bodyLog) {
  const parts = [];
  if (workout?.steps) parts.push(`${Number(workout.steps).toLocaleString()} steps`);
  else parts.push("No steps logged");
  if (bodyLog) {
    parts.push(`${Number(bodyLog.weight).toFixed(1)} kg`);
    if (bodyLog.body_fat) parts.push(`${bodyLog.body_fat}% body fat`);
  }
  return parts.join(" - ");
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function calendarDays(month) {
  const first = startOfMonth(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatLongDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

export default App;
