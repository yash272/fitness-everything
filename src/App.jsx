import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Activity, BarChart3, Bolt, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, Dumbbell, Moon, Plus, RefreshCw, Scale, Sun, Trash2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { buildWeightChartModel } from "./weightChartUtils";

const DEFAULT_WORKOUT_TYPES = ["Push", "Pull", "Legs", "Cardio", "Sports", "Mobility"];
const DEFAULT_EXERCISES = {
  Push: ["Bench Press", "Incline Dumbbell Press", "Shoulder Press", "Lateral Raise", "Triceps Pushdown"],
  Pull: ["Deadlift", "Pull Up", "Lat Pulldown", "Barbell Row", "Bicep Curl"],
  Legs: ["Squat", "Leg Press", "Romanian Deadlift", "Leg Curl", "Calf Raise"],
  Cardio: ["Treadmill", "Bike", "Rowing", "Stair Climber", "Elliptical"],
  Sports: ["Badminton", "Basketball", "Soccer", "Tennis"],
  Mobility: ["Stretching", "Yoga", "Warmup"]
};
const TRACKING_MODES = {
  weighted: "Weighted",
  bodyweight: "Reps",
  time: "Time"
};
const FUTURE_WORKOUT_NOTICE = "Workout dates can only be today or earlier.";

const todayKey = () => dateKey(new Date());
const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const isFutureDateKey = (date) => Boolean(date && date > todayKey());
const formatDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function App() {
  if (!isSupabaseConfigured) return <SetupMissing />;

  return <Tracker />;
}

function Tracker() {
  const userId = import.meta.env.VITE_PERSONAL_USER_ID;
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem("fitness-active-view");
    return ["dashboard", "daily", "workout", "body"].includes(saved) ? saved : "dashboard";
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("fitness-theme") || "light");
  const [range, setRange] = useState(30);
  const [workouts, setWorkouts] = useState([]);
  const [bodyLogs, setBodyLogs] = useState([]);
  const [logDate, setLogDate] = useState(todayKey());
  const [workoutDate, setWorkoutDate] = useState(todayKey());
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [calendarMode, setCalendarMode] = useState(() => localStorage.getItem("fitness-calendar-mode") === "month" ? "month" : "week");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isWorkoutDatePickerOpen, setIsWorkoutDatePickerOpen] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({ name: "", trackingType: "weighted", sets: [{ reps: "10", weight: "", duration: "" }] });
  const [bodyForm, setBodyForm] = useState({ weight: "", bodyFat: "" });
  const [notice, setNotice] = useState("");
  const [exportFile, setExportFile] = useState(null);
  const workoutDateInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("fitness-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("fitness-calendar-mode", calendarMode);
  }, [calendarMode]);

  useEffect(() => {
    localStorage.setItem("fitness-active-view", activeView);
  }, [activeView]);

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [activeView]);

  useEffect(() => () => {
    if (exportFile?.url) URL.revokeObjectURL(exportFile.url);
  }, [exportFile]);

  const todayWorkout = useMemo(() => workouts.find((workout) => workout.workout_date === todayKey()), [workouts]);
  const selectedWorkout = useMemo(() => workouts.find((workout) => workout.workout_date === workoutDate), [workouts, workoutDate]);
  const exerciseNames = useMemo(() => {
    const names = new Set(Object.values(DEFAULT_EXERCISES).flat());
    workouts.forEach((workout) => workout.exercises?.forEach((exercise) => names.add(exercise.name)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [workouts]);
  const workoutTypes = useMemo(() => {
    const types = new Set(DEFAULT_WORKOUT_TYPES);
    workouts.forEach((workout) => {
      const type = workoutTypeForEdit(workout);
      if (type) types.add(type);
    });
    return [...types].sort((a, b) => a.localeCompare(b));
  }, [workouts]);
  const recentPrs = useMemo(() => {
    const prs = [];
    workouts.forEach((workout) => {
      workout.exercises?.forEach((exercise) => {
        exercise.exercise_sets?.forEach((set) => {
          if (set.is_pr) {
            prs.push({ ...set, exercise: exercise.name, trackingType: exercise.tracking_type || "weighted", split: workout.split, date: workout.workout_date });
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
        .select("id,user_id,workout_date,split,did_workout,steps,created_at,updated_at,exercises(id,user_id,name,tracking_type,created_at,exercise_sets(id,user_id,reps,weight,duration_minutes,is_pr,logged_at))")
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
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isWorkoutDatePickerOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const input = workoutDateInputRef.current;
      input?.focus({ preventScroll: true });
      try {
        input?.showPicker?.();
      } catch {
        input?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isWorkoutDatePickerOpen]);

  async function ensureWorkoutForDate(date = todayKey(), split, fields = {}) {
    if (isFutureDateKey(date)) throw new Error(FUTURE_WORKOUT_NOTICE);

    const existing = workouts.find((workout) => workout.workout_date === date);
    if (existing) {
      const patch = { ...(split === undefined ? {} : { split }), ...fields, updated_at: new Date().toISOString() };
      await supabase.from("workouts").update(patch).eq("id", existing.id);
      const updated = { ...existing, ...patch };
      setWorkouts((items) => sortWorkouts(items.map((item) => item.id === existing.id ? updated : item)));
      return updated;
    }

    const { data, error } = await supabase
      .from("workouts")
      .insert({ user_id: userId, workout_date: date, split: split ?? "", ...fields })
      .select("id,user_id,workout_date,split,did_workout,steps,created_at,updated_at,exercises(id,user_id,name,tracking_type,created_at,exercise_sets(id,user_id,reps,weight,duration_minutes,is_pr,logged_at))")
      .single();

    if (error) throw error;
    const next = { ...data, exercises: [] };
    setWorkouts((items) => sortWorkouts([next, ...items]));
    return next;
  }

  function selectLogDate(date) {
    if (!date) return;
    setLogDate(date);
    setCalendarMonth(startOfMonth(new Date(`${date}T12:00:00`)));
  }

  function selectWorkoutDate(date) {
    if (!date) return;
    if (isFutureDateKey(date)) {
      setNotice(FUTURE_WORKOUT_NOTICE);
      setWorkoutDate(todayKey());
      setIsWorkoutDatePickerOpen(false);
      return;
    }
    setWorkoutDate(date);
    setIsWorkoutDatePickerOpen(false);
  }

  function changeView(view) {
    setIsWorkoutDatePickerOpen(false);
    if (view === "workout" && isFutureDateKey(workoutDate)) {
      setNotice(FUTURE_WORKOUT_NOTICE);
      setWorkoutDate(todayKey());
    }
    setActiveView(view);
  }

  function bestBefore(exerciseName, trackingType = "weighted", beforeDate = todayKey()) {
    let best = null;
    workouts.forEach((workout) => {
      if (workout.workout_date >= beforeDate) return;
      workout.exercises?.forEach((exercise) => {
        if (exercise.name.toLowerCase() !== exerciseName.toLowerCase()) return;
        const type = exercise.tracking_type || "weighted";
        if (type !== trackingType) return;
        exercise.exercise_sets?.forEach((set) => {
          if (isBetterSet(set, best, trackingType)) {
            best = { ...set, date: workout.workout_date };
          }
        });
      });
    });
    return best;
  }

  async function addExercise(event) {
    event.preventDefault();
    const name = exerciseForm.name.trim();
    const trackingType = exerciseForm.trackingType;
    const setRowsInput = exerciseForm.sets
      .map((set) => normalizeSetInput(set, trackingType))
      .filter(Boolean);
    if (!name || !setRowsInput.length) return;

    setSaving(true);
    setNotice("");
    try {
      const workoutType = workoutTypeForEdit(selectedWorkout);
      const workout = await ensureWorkoutForDate(workoutDate, workoutType, { did_workout: true });
      const previous = bestBefore(name, trackingType, workoutDate);

      const { data: exercise, error: exerciseError } = await supabase
        .from("exercises")
        .insert({ workout_id: workout.id, user_id: userId, name, tracking_type: trackingType })
        .select("id,user_id,name,tracking_type,created_at")
        .single();
      if (exerciseError) throw exerciseError;

      const setRows = setRowsInput.map((set) => ({
        exercise_id: exercise.id,
        user_id: userId,
        reps: set.reps,
        weight: set.weight,
        duration_minutes: set.duration_minutes,
        is_pr: Boolean(previous) && isBetterSet(set, previous, trackingType)
      }));
      const { data: sets, error: setError } = await supabase
        .from("exercise_sets")
        .insert(setRows)
        .select("id,user_id,reps,weight,duration_minutes,is_pr,logged_at");
      if (setError) throw setError;

      const nextExercise = { ...exercise, exercise_sets: sets };
      setWorkouts((items) => upsertExercise(items, workout.id, nextExercise));
      setExerciseForm({ name: "", trackingType, sets: [defaultSetForMode(trackingType)] });
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function repeatSet(exercise) {
    const last = exercise.exercise_sets?.at(-1);
    if (!last) return;
    const trackingType = exercise.tracking_type || "weighted";
    const exerciseWorkoutDate = workouts.find((workout) => workout.exercises?.some((item) => item.id === exercise.id))?.workout_date || workoutDate;
    if (isFutureDateKey(exerciseWorkoutDate)) {
      setNotice(FUTURE_WORKOUT_NOTICE);
      setWorkoutDate(todayKey());
      return;
    }
    const previous = bestBefore(exercise.name, trackingType, exerciseWorkoutDate);
    const repeated = {
      reps: last.reps,
      weight: last.weight,
      duration_minutes: last.duration_minutes
    };
    const isPr = Boolean(previous) && isBetterSet(repeated, previous, trackingType);
    setSaving(true);
    const { data, error } = await supabase
      .from("exercise_sets")
      .insert({ exercise_id: exercise.id, user_id: userId, ...repeated, is_pr: isPr })
      .select("id,user_id,reps,weight,duration_minutes,is_pr,logged_at")
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
    const exerciseWorkoutDate = workouts.find((workout) => workout.exercises?.some((exercise) => exercise.id === exerciseId))?.workout_date;
    if (isFutureDateKey(exerciseWorkoutDate)) {
      setNotice(FUTURE_WORKOUT_NOTICE);
      setWorkoutDate(todayKey());
      return;
    }

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
    try {
      await ensureWorkoutForDate(workoutDate, split, { did_workout: true });
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function saveDailyLog({ date, steps }) {
    setSaving(true);
    setNotice("");
    try {
      const fields = {};
      if (steps !== undefined) fields.steps = steps === "" ? null : Number(steps);

      await ensureWorkoutForDate(date, undefined, fields);
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function exportMonthData() {
    const payload = buildMonthExport({
      month: calendarMonth,
      workouts,
      bodyLogs,
      userId
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `fitness-everything-${payload.period.month}.json`;
    if (exportFile?.url) URL.revokeObjectURL(exportFile.url);
    setExportFile({ url, filename, label: payload.period.label });
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => link.remove(), 0);
    setNotice(`Export ready for ${payload.period.label}. If it did not download automatically, use the download link below.`);
  }

  const workoutSets = todayWorkout?.exercises?.reduce((sum, exercise) => sum + exercise.exercise_sets.length, 0) || 0;
  const todayPrs = todayWorkout?.exercises?.reduce((sum, exercise) => sum + exercise.exercise_sets.filter((set) => set.is_pr).length, 0) || 0;
  const latestBody = bodyLogs.at(-1);
  const weekDays = workoutDaysWithin(workouts, weekStartKey(), todayKey());
  const monthDays = workoutDaysWithin(workouts, monthStartKey(), todayKey());
  const todaySteps = todayWorkout?.steps || 0;
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "daily", label: "Logs", icon: CalendarDays },
    { id: "workout", label: "Workout", icon: Dumbbell },
    { id: "body", label: "Body", icon: Scale }
  ];
  const viewTitles = {
    dashboard: "Dashboard",
    daily: "Logs",
    workout: "Workout",
    body: "Body"
  };
  const activeTitle = viewTitles[activeView] || viewTitles.dashboard;
  const dateChipDate = activeView === "workout" ? workoutDate : todayKey();
  const dateChipLabel = new Date(`${dateChipDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Bolt size={18} strokeWidth={2.4} /></span>
          <strong>fitness</strong>
        </div>
        <nav className="desktop-tabs" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`${activeView === item.id ? "active" : ""} ${item.id === "workout" ? "workout-tab" : ""}`.trim()}
                onClick={() => changeView(item.id)}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="top-actions">
          <button className="icon-button export-button" onClick={exportMonthData} aria-label="Export current month JSON" title="Export current month JSON">
            <Download size={18} />
            <span>Export</span>
          </button>
          <button
            className="icon-button"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
      </header>

      <main className={`app view-frame view-${activeView}`} key={activeView}>
        <section className="hero-row">
          <h1>{activeTitle}</h1>
          {activeView === "workout" ? (
            <div className="date-chip date-chip-picker">
              <button type="button" className="date-chip-trigger" onClick={() => setIsWorkoutDatePickerOpen((open) => !open)} aria-expanded={isWorkoutDatePickerOpen} aria-label="Change workout date" title="Change workout date">
                <CalendarDays size={16} />
                <span>{dateChipLabel}</span>
              </button>
              {isWorkoutDatePickerOpen ? (
                <div className="date-popover">
                  <input ref={workoutDateInputRef} type="date" value={workoutDate} max={todayKey()} onChange={(event) => selectWorkoutDate(event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Escape") setIsWorkoutDatePickerOpen(false);
                  }} aria-label="Workout date" />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="date-chip">
              <CalendarDays size={16} />
              {dateChipLabel}
            </div>
          )}
        </section>

        {notice && (
          <div className="notice">
            <span>{notice}</span>
            {exportFile ? (
              <a className="export-link" href={exportFile.url} download={exportFile.filename}>
                <Download size={16} />
                Download JSON
              </a>
            ) : null}
          </div>
        )}
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
            selectedDate={logDate}
            setSelectedDate={selectLogDate}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            calendarMode={calendarMode}
            setCalendarMode={setCalendarMode}
          />
        )}

        {!loading && activeView === "workout" && (
          <WorkoutView
            selectedDate={workoutDate}
            selectedSplit={workoutTypeForEdit(selectedWorkout)}
            changeSplit={changeSplit}
            exerciseForm={exerciseForm}
            setExerciseForm={setExerciseForm}
            isAddingExercise={isAddingExercise}
            setIsAddingExercise={setIsAddingExercise}
            addExercise={addExercise}
            exerciseNames={exerciseNames}
            workoutTypes={workoutTypes}
            selectedWorkout={selectedWorkout}
            saveDailyLog={saveDailyLog}
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

      <nav className="mobile-tabs" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`${activeView === item.id ? "active" : ""} ${item.id === "workout" ? "workout-tab" : ""}`.trim()}
              onClick={() => changeView(item.id)}
            >
              <Icon size={21} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Dashboard({ workoutSets, todayWorkout, todayPrs, latestBody, weekDays, monthDays, bodyLogs, range, setRange, recentPrs, todaySteps }) {
  const didWorkoutToday = hasWorkoutActivity(todayWorkout);
  const chartModel = useMemo(() => buildWeightChartModel(bodyLogs, range), [bodyLogs, range]);
  const firstVisibleWeight = chartModel.points[0] ? Number(chartModel.points[0].weight) : null;
  const latestVisibleWeight = chartModel.points.at(-1) ? Number(chartModel.points.at(-1).weight) : null;
  const visibleWeightChange = firstVisibleWeight === null || latestVisibleWeight === null
    ? null
    : latestVisibleWeight - firstVisibleWeight;
  const visibleWeightChangeLabel = visibleWeightChange === null
    ? "--"
    : `${visibleWeightChange > 0 ? "+" : ""}${visibleWeightChange.toFixed(1)} kg`;

  return (
    <div className="dashboard-layout">
      <FocusStage className="dashboard-focus">
        <div className="focus-stage-head">
          <div>
            <span className="stage-label">Latest weight</span>
            <strong className="stage-value data-value">
              {latestBody ? Number(latestBody.weight).toFixed(1) : "--"}
              <small> kg</small>
            </strong>
            <p>{latestBody ? formatDate(latestBody.log_date) : "No weigh-in yet"}</p>
          </div>
          <div className="segmented segmented-dark" aria-label="Weight range">
            {[30, 60, 90].map((days) => (
              <button
                key={days}
                className={range === days ? "active" : ""}
                onClick={() => setRange(days)}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
        <WeightChart logs={bodyLogs} range={range} />
        <div className="trend-meta trend-meta-dark">
          <div>
            <span>Change</span>
            <strong className="data-value">{visibleWeightChangeLabel}</strong>
          </div>
          <div>
            <span>Body fat</span>
            <strong className="data-value">{latestBody?.body_fat ? `${latestBody.body_fat}%` : "--"}</strong>
          </div>
        </div>
      </FocusStage>

      <div className="dashboard-after-grid">
        <section className="stat-grid dashboard-support-stats">
          <Stat label="Today" value={didWorkoutToday ? workoutTypeLabel(todayWorkout.split) : "Rest"} detail={didWorkoutToday ? `${workoutSets} sets - ${todayWorkout?.exercises?.length || 0} exercises - ${todayPrs} PR sets` : "No exercise sets logged today"} />
          <Stat label="This Week" value={`${weekDays} days`} detail="Workout days since Monday" />
          <Stat label="This Month" value={`${monthDays} days`} detail="Workout days this month" />
          <Stat label="Steps Today" value={todaySteps ? todaySteps.toLocaleString() : "--"} detail={todaySteps ? "Logged today" : "No steps yet"} />
        </section>

        <section className="panel-section pr-panel">
          <div className="section-head">
            <h2>Recent PRs</h2>
          </div>
          <div className="list pr-list">
            {recentPrs.length ? recentPrs.map((pr) => (
              <div className="row" key={pr.id}>
                <div>
                  <strong>{pr.exercise}</strong>
                  <span>{formatDate(pr.date)} - {workoutTypeLabel(pr.split)}</span>
                </div>
                <b>{formatSet(pr, pr.trackingType)}</b>
              </div>
            )) : <Empty text="No PRs yet." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function DailyView({ workouts, bodyLogs, selectedDate, setSelectedDate, calendarMonth, setCalendarMonth, calendarMode, setCalendarMode }) {
  const selectedLog = workouts.find((workout) => workout.workout_date === selectedDate);
  const selectedBodyLog = bodyLogs.find((entry) => entry.log_date === selectedDate);
  const selectedDateObject = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const weekStart = useMemo(() => startOfWeek(selectedDateObject), [selectedDateObject]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  function moveWeek(amount) {
    const next = addDays(weekStart, amount * 7);
    setSelectedDate(dateKey(next));
    setCalendarMonth(startOfMonth(next));
  }

  return (
    <>
      <section className="panel-section">
        <div className="section-head">
          <div>
            <h2>{calendarMode === "week" ? `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}` : calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          </div>
          <div className="calendar-actions">
            <div className="segmented view-switch">
              <button className={calendarMode === "week" ? "active" : ""} onClick={() => setCalendarMode("week")} aria-label="Show week view" title="Week view">
                <CalendarDays size={14} />
              </button>
              <button className={calendarMode === "month" ? "active" : ""} onClick={() => setCalendarMode("month")} aria-label="Show month view" title="Month view">
                <CalendarRange size={14} />
              </button>
            </div>
            <div className="calendar-nav">
              <button className="secondary mini" onClick={() => calendarMode === "week" ? moveWeek(-1) : setCalendarMonth(addMonths(calendarMonth, -1))} aria-label={`Previous ${calendarMode}`} title={`Previous ${calendarMode}`}>
                <ChevronLeft size={14} />
              </button>
              <button className="secondary mini" onClick={() => calendarMode === "week" ? moveWeek(1) : setCalendarMonth(addMonths(calendarMonth, 1))} aria-label={`Next ${calendarMode}`} title={`Next ${calendarMode}`}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
        {calendarMode === "week" ? (
          <WeekGrid
            weekStart={weekStart}
            workouts={workouts}
            bodyLogs={bodyLogs}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        ) : (
          <CalendarGrid
            month={calendarMonth}
            workouts={workouts}
            bodyLogs={bodyLogs}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}
      </section>

      <section className="panel-section">
        <h2>{formatLongDate(selectedDate)} Workouts</h2>
        <DayWorkoutDetails workout={selectedLog} bodyLog={selectedBodyLog} />
      </section>
    </>
  );
}

function WeekGrid({ weekStart, workouts, bodyLogs, selectedDate, setSelectedDate }) {
  const logsByDate = new Map(workouts.map((workout) => [workout.workout_date, workout]));
  const bodyLogsByDate = new Map(bodyLogs.map((entry) => [entry.log_date, entry]));
  const days = Array.from({ length: 7 }, (_item, index) => addDays(weekStart, index));

  return (
    <div className="week-grid">
      {days.map((day) => {
        const key = dateKey(day);
        const log = logsByDate.get(key);
        const bodyLog = bodyLogsByDate.get(key);
        const didWorkout = hasWorkoutActivity(log);
        return (
          <button
            key={key}
            className={`week-day ${selectedDate === key ? "selected" : ""} ${didWorkout ? "trained" : "rest"}`}
            onClick={() => setSelectedDate(key)}
          >
            <strong>
              <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
              {day.getDate()}
            </strong>
            <div>
              <b>{didWorkout ? workoutTypeLabel(log.split, "Gym") : "Rest"}</b>
              <small>{log?.steps ? formatCalendarSteps(log.steps) : "--"}</small>
              <small>{bodyLog ? Number(bodyLog.weight).toFixed(1) : "--"}</small>
            </div>
          </button>
        );
      })}
    </div>
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
  if (!hasWorkoutActivity(workout)) {
    return (
      <div className="day-summary rest">
        <strong>Rest day</strong>
        <span>{dailyMeta(workout, bodyLog)}</span>
      </div>
    );
  }

  return (
    <div className="day-detail">
      <div className="day-summary">
        <strong>{workoutTypeLabel(workout.split)}</strong>
        <span>{dailyMeta(workout, bodyLog)}</span>
      </div>
      {workout.exercises?.length ? workout.exercises.map((exercise) => (
        <article className="mini-exercise" key={exercise.id}>
          <h3>{exercise.name}</h3>
          <div>
            {exercise.exercise_sets.map((set, index) => (
              <span key={set.id}>{index + 1}. {formatSet(set, exercise.tracking_type || "weighted")}{set.is_pr ? " PR" : ""}</span>
            ))}
          </div>
        </article>
      )) : <Empty text={`${workoutTypeLabel(workout.split)} day saved. No exercise sets logged yet.`} />}
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
        const didWorkout = hasWorkoutActivity(log);
        const hasSteps = Number(log?.steps) > 0;
        return (
          <button
            key={key}
            className={`calendar-day ${isCurrentMonth ? "" : "muted"} ${selectedDate === key ? "selected" : ""} ${isSaved ? "saved" : "unsaved"} ${didWorkout ? "trained" : "rest"}`}
            onClick={() => setSelectedDate(key)}
          >
            <strong>{day.getDate()}</strong>
            <span className="calendar-workout">{didWorkout ? log.split : isSaved ? "Rest" : ""}</span>
            <span className="calendar-metric">{hasSteps ? formatCalendarSteps(log.steps) : ""}</span>
            <small>{bodyLog ? Number(bodyLog.weight).toFixed(1) : ""}</small>
            <span className="calendar-dots" aria-label={`${didWorkout ? "Workout logged" : "Rest day"}, ${hasSteps ? "steps logged" : "no steps"}, ${bodyLog ? "weight logged" : "no weight"}`}>
              <i className={didWorkout ? "active workout" : ""}></i>
              <i className={hasSteps ? "active steps" : ""}></i>
              <i className={bodyLog ? "active weight" : ""}></i>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WorkoutView({ selectedDate, selectedSplit, changeSplit, exerciseForm, setExerciseForm, isAddingExercise, setIsAddingExercise, addExercise, exerciseNames, workoutTypes, selectedWorkout, saveDailyLog, bestBefore, repeatSet, deleteExercise, saving }) {
  const [isEditingType, setIsEditingType] = useState(false);
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [typeDraft, setTypeDraft] = useState(selectedSplit);
  const [stepsDraft, setStepsDraft] = useState(selectedWorkout?.steps ?? "");
  const workoutTypeTitle = selectedSplit ? workoutTypeLabel(selectedSplit) : "Workout Type";

  useEffect(() => {
    setIsEditingType(false);
    setTypeDraft(selectedSplit);
  }, [selectedSplit]);

  useEffect(() => {
    setIsEditingSteps(false);
    setStepsDraft(selectedWorkout?.steps ?? "");
  }, [selectedDate, selectedWorkout?.steps]);

  async function saveWorkoutType(event) {
    event.preventDefault();
    const next = typeDraft.trim();
    if (!next) return;
    if (next !== selectedSplit) await changeSplit(next);
    setIsEditingType(false);
  }

  async function saveWorkoutSteps(event) {
    event.preventDefault();
    const saved = await saveDailyLog({
      date: selectedDate,
      steps: stepsDraft
    });
    if (saved) setIsEditingSteps(false);
  }

  function updateSet(index, field, value) {
    setExerciseForm({
      ...exerciseForm,
      sets: exerciseForm.sets.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set)
    });
  }

  function addSetRow() {
    const last = exerciseForm.sets.at(-1) || { reps: "10", weight: "", duration: "" };
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
      <section className="panel-section form">
        <div className="daily-control-head">
          <div>
            <h2>{workoutTypeTitle}</h2>
            <p>{selectedSplit ? selectedDate === todayKey() ? "Today" : formatLongDate(selectedDate) : `No type set for ${selectedDate === todayKey() ? "today" : formatLongDate(selectedDate)}`}</p>
          </div>
          {!isEditingType ? (
            <button type="button" className="secondary mini" onClick={() => setIsEditingType(true)}>Edit</button>
          ) : null}
        </div>
        {isEditingType ? (
          <form className="form" onSubmit={saveWorkoutType}>
            <label>
              Type
              <input
                value={typeDraft}
                list="workout-type-options"
                placeholder="Push, Badminton, Run..."
                onChange={(event) => setTypeDraft(event.target.value)}
              />
              <datalist id="workout-type-options">
                {workoutTypes.map((type) => <option key={type} value={type} />)}
              </datalist>
            </label>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => {
                setTypeDraft(selectedSplit);
                setIsEditingType(false);
              }}>Cancel</button>
              <button className="primary" disabled={saving || !typeDraft.trim()}><Dumbbell size={18} />Save Type</button>
            </div>
          </form>
        ) : null}

        <div className="workout-steps">
          <div className="daily-control-head">
            <div>
              <h3>Steps</h3>
              <p>{selectedWorkout?.steps ? `${Number(selectedWorkout.steps).toLocaleString()} steps saved` : "No steps saved"}</p>
            </div>
            {!isEditingSteps ? (
              <button type="button" className="secondary mini" onClick={() => setIsEditingSteps(true)}>Edit</button>
            ) : null}
          </div>
          {isEditingSteps ? (
            <form className="form" onSubmit={saveWorkoutSteps}>
              <div className="one-field">
                <label>
                  Steps
                  <input type="number" min="0" inputMode="numeric" value={stepsDraft} placeholder="8500" onChange={(event) => setStepsDraft(event.target.value)} />
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => {
                  setStepsDraft(selectedWorkout?.steps ?? "");
                  setIsEditingSteps(false);
                }}>Cancel</button>
                <button className="primary" disabled={saving}><CalendarDays size={18} />Save Steps</button>
              </div>
            </form>
          ) : null}
        </div>
      </section>

      {isAddingExercise ? (
        <form className="panel-section form" onSubmit={addExercise}>
          <div className="daily-control-head">
            <div>
              <h2>Add Exercise</h2>
              <p>{selectedSplit ? `Add to ${workoutTypeLabel(selectedSplit)}` : formatLongDate(selectedDate)}</p>
            </div>
            <button type="button" className="secondary mini" onClick={() => setIsAddingExercise(false)}>Close</button>
          </div>
          <label>
            Exercise
            <input value={exerciseForm.name} list="exercise-options" placeholder="Bench Press" onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} />
            <datalist id="exercise-options">
              {exerciseNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <div className="mode-grid">
            {Object.entries(TRACKING_MODES).map(([mode, label]) => (
              <button
                type="button"
                key={mode}
                className={exerciseForm.trackingType === mode ? "active" : ""}
                onClick={() => setExerciseForm({ ...exerciseForm, trackingType: mode, sets: [defaultSetForMode(mode)] })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="set-editor">
            {exerciseForm.sets.map((set, index) => (
              <div className={`set-input-row ${exerciseForm.trackingType}`} key={index}>
                <span>{index + 1}</span>
                {exerciseForm.trackingType !== "time" ? (
                  <label>
                    Reps
                    <input type="number" min="1" inputMode="numeric" value={set.reps} onChange={(event) => updateSet(index, "reps", event.target.value)} />
                  </label>
                ) : null}
                {exerciseForm.trackingType === "weighted" ? (
                  <label>
                    Lbs
                    <input type="number" min="0" step="2.5" inputMode="decimal" value={set.weight} placeholder="135" onChange={(event) => updateSet(index, "weight", event.target.value)} />
                  </label>
                ) : null}
                {exerciseForm.trackingType === "time" ? (
                  <label>
                    Minutes
                    <input type="number" min="1" step="1" inputMode="numeric" value={set.duration} placeholder="45" onChange={(event) => updateSet(index, "duration", event.target.value)} />
                  </label>
                ) : null}
                <button type="button" className="danger icon-only" onClick={() => removeSetRow(index)} disabled={exerciseForm.sets.length === 1} aria-label={`Remove set ${index + 1}`} title={`Remove set ${index + 1}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addSetRow}><Plus size={17} />Add Set</button>
          </div>
          <button className="primary" disabled={saving}><Plus size={18} />Add Exercise</button>
        </form>
      ) : (
        <section className="panel-section add-exercise-prompt">
          <button type="button" className="primary add-exercise-toggle" onClick={() => setIsAddingExercise(true)}>
            <Plus size={18} />Add Exercise
          </button>
        </section>
      )}

      <section className="panel-section">
        <h2>{selectedDate === todayKey() ? "Today's Workout" : `${formatLongDate(selectedDate)} Workout`}</h2>
        <div className="exercise-list">
          {selectedWorkout?.exercises?.length ? selectedWorkout.exercises.map((exercise) => {
            const trackingType = exercise.tracking_type || "weighted";
            const previous = bestBefore(exercise.name, trackingType, selectedDate);
            const prCount = exercise.exercise_sets.filter((set) => set.is_pr).length;
            return (
              <article className="exercise-card" key={exercise.id}>
                <div className="exercise-head">
                  <div>
                    <h3>{exercise.name}</h3>
                    <p>{previous ? `Previous best: ${formatSet(previous, trackingType)} on ${formatDate(previous.date)}` : "No previous session yet"}</p>
                  </div>
                  {prCount ? <span className="badge">PR</span> : null}
                </div>
                <div className="sets">
                  {exercise.exercise_sets.map((set, index) => (
                    <div className="set-row" key={set.id}>
                      <span>{index + 1}</span>
                      <b>{formatSet(set, trackingType)}</b>
                      <em>{set.is_pr ? "NEW PR" : ""}</em>
                    </div>
                  ))}
                </div>
                <div className="card-actions">
                  <button type="button" className="secondary" onClick={() => repeatSet(exercise)} disabled={saving}><RefreshCw size={17} />Repeat Set</button>
                  <button type="button" className="danger" onClick={() => deleteExercise(exercise.id)} disabled={saving} aria-label={`Delete ${exercise.name}`} title={`Delete ${exercise.name}`}><Trash2 size={17} /></button>
                </div>
              </article>
            );
          }) : <Empty text="No exercises logged for this day." />}
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
          )) : <Empty text="No weigh-ins yet." />}
        </div>
      </section>
    </>
  );
}

function WeightChart({ logs, range }) {
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const plotRef = useRef(null);
  const tooltipRef = useRef(null);
  const model = useMemo(() => buildWeightChartModel(logs, range), [logs, range]);
  const selectedPoint = model.points.find((point) => point.id === selectedPointId);

  useEffect(() => {
    setSelectedPointId(null);
  }, [range]);

  useLayoutEffect(() => {
    const plot = plotRef.current;
    const tooltip = tooltipRef.current;
    if (!selectedPoint || !plot || !tooltip) return undefined;

    const positionTooltip = () => {
      const plotRect = plot.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const anchorX = (selectedPoint.x / 100) * plotRect.width;
      const anchorY = (selectedPoint.y / 100) * plotRect.height;
      const halfTooltipWidth = tooltipRect.width / 2;
      const gap = 8;
      const edgeInset = 1;

      setTooltipPosition({
        id: selectedPoint.id,
        left: Math.min(
          plotRect.width - halfTooltipWidth - edgeInset,
          Math.max(halfTooltipWidth + edgeInset, anchorX)
        ),
        top: Math.min(
          plotRect.height - edgeInset,
          Math.max(tooltipRect.height + edgeInset, anchorY - gap)
        )
      });
    };

    positionTooltip();
    const resizeObserver = new ResizeObserver(positionTooltip);
    resizeObserver.observe(plot);
    resizeObserver.observe(tooltip);
    return () => resizeObserver.disconnect();
  }, [selectedPoint]);

  if (model.points.length < 2) {
    return (
      <div className="chart empty-chart" role="img" aria-label="Weight trend chart">
        <span>Log at least two weights to see your trend</span>
      </div>
    );
  }

  return (
    <div
      className="chart graph-chart"
      role="group"
      aria-label={`Weight trend from ${formatDate(model.points[0].log_date)} to ${formatDate(model.points.at(-1).log_date)}`}
    >
      <div className="chart-y-axis" aria-hidden="true">
        <span>{model.max.toFixed(1)} kg</span>
        <span>{model.mid.toFixed(1)} kg</span>
        <span>{model.min.toFixed(1)} kg</span>
      </div>
      <div className="chart-plot" ref={plotRef}>
        <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[16, 52, 88].map((y) => (
            <line key={y} className="chart-gridline" x1="0" y1={y} x2="100" y2={y} />
          ))}
          <polygon className="chart-area" points={model.areaPoints} />
          <polyline className="chart-line" points={model.svgPoints} />
        </svg>
        {model.points.map((point) => (
          <button
            type="button"
            key={point.id}
            className={`chart-hit ${selectedPointId === point.id ? "selected" : ""}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            aria-label={`${formatDate(point.log_date)}, ${Number(point.weight).toFixed(1)} kilograms`}
            onClick={() => setSelectedPointId(point.id)}
            onFocus={() => setSelectedPointId(point.id)}
          />
        ))}
        {selectedPoint ? (
          <output
            className="chart-tooltip"
            ref={tooltipRef}
            style={{
              left: tooltipPosition?.id === selectedPoint.id ? tooltipPosition.left : 0,
              top: tooltipPosition?.id === selectedPoint.id ? tooltipPosition.top : 0,
              visibility: tooltipPosition?.id === selectedPoint.id ? "visible" : "hidden"
            }}
          >
            {formatDate(selectedPoint.log_date)} · {Number(selectedPoint.weight).toFixed(1)} kg
          </output>
        ) : null}
      </div>
      <div className="chart-x-axis" aria-hidden="true">
        {model.labelIndexes.map((index) => (
          <span key={model.points[index].id}>{formatDate(model.points[index].log_date)}</span>
        ))}
      </div>
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

function FocusStage({ className = "", children }) {
  return <section className={`focus-stage ${className}`.trim()}>{children}</section>;
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
  return workouts.filter((workout) => workout.workout_date >= startDate && workout.workout_date <= endDate && hasWorkoutActivity(workout)).length;
}

function hasWorkoutActivity(workout) {
  return Boolean(workout?.exercises?.some((exercise) => exercise.exercise_sets?.length));
}

function workoutTypeForEdit(workout) {
  return workout?.split?.trim() || "";
}

function workoutTypeLabel(split, fallback = "Workout") {
  return split?.trim() || fallback;
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

function defaultSetForMode(mode) {
  if (mode === "time") return { reps: "", weight: "", duration: "30" };
  if (mode === "bodyweight") return { reps: "10", weight: "", duration: "" };
  return { reps: "10", weight: "", duration: "" };
}

function normalizeSetInput(set, trackingType) {
  if (trackingType === "time") {
    const duration = Number(set.duration);
    if (!duration || Number.isNaN(duration)) return null;
    return { reps: null, weight: null, duration_minutes: duration };
  }

  const reps = Number(set.reps);
  if (!reps || Number.isNaN(reps)) return null;

  if (trackingType === "bodyweight") {
    return { reps, weight: null, duration_minutes: null };
  }

  const weight = Number(set.weight);
  if (set.weight === "" || Number.isNaN(weight)) return null;
  return { reps, weight, duration_minutes: null };
}

function isBetterSet(candidate, currentBest, trackingType) {
  if (!candidate) return false;
  if (!currentBest) return true;

  if (trackingType === "time") {
    return Number(candidate.duration_minutes || 0) > Number(currentBest.duration_minutes || 0);
  }

  if (trackingType === "bodyweight") {
    return Number(candidate.reps || 0) > Number(currentBest.reps || 0);
  }

  const candidateWeight = Number(candidate.weight || 0);
  const bestWeight = Number(currentBest.weight || 0);
  return candidateWeight > bestWeight || (candidateWeight === bestWeight && Number(candidate.reps || 0) > Number(currentBest.reps || 0));
}

function formatSet(set, trackingType = "weighted") {
  if (trackingType === "time") return `${Number(set.duration_minutes || 0)} min`;
  if (trackingType === "bodyweight") return `${set.reps} reps`;
  return `${Number(set.weight || 0)} lbs x ${set.reps}`;
}

function formatCalendarSteps(steps) {
  const count = Number(steps || 0);
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toLocaleString();
}

function buildMonthExport({ month, workouts, bodyLogs, userId }) {
  const start = startOfMonth(month);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const workoutsByDate = new Map(workouts.map((workout) => [workout.workout_date, workout]));
  const bodyLogsByDate = new Map(bodyLogs.map((entry) => [entry.log_date, entry]));
  const days = Array.from({ length: end.getDate() }, (_item, index) => {
    const day = addDays(start, index);
    const key = dateKey(day);
    const workout = workoutsByDate.get(key);
    const bodyLog = bodyLogsByDate.get(key);
    return {
      date: key,
      steps: workout?.steps ?? null,
      weight_kg: bodyLog ? Number(bodyLog.weight) : null,
      body_fat_percent: bodyLog?.body_fat == null ? null : Number(bodyLog.body_fat),
      gym: hasWorkoutActivity(workout),
      workout_type: workoutTypeForEdit(workout) || null,
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
  });

  return {
    exported_at: new Date().toISOString(),
    app: "fitness everything",
    user_id: userId,
    period: {
      type: "month",
      month: monthKey,
      start_date: dateKey(start),
      end_date: dateKey(end),
      label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    },
    units: {
      body_weight: "kg",
      set_weight: "lbs",
      time: "minutes"
    },
    days
  };
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
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

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default App;
