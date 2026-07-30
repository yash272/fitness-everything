import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, Dumbbell, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createRootScreen,
  createWorkoutScreen,
  historyStateForScreen,
  screenFromHistoryState,
  screensMatch,
  screenStorageValue
} from "./appState";
import AppHeader from "./AppHeader";
import { buildFitnessExport, exportFilename } from "./exportData";
import HistoryView from "./HistoryView";
import { normalizeStepsInput, normalizeWeightInput } from "./quickLogUtils";
import SuggestedWorkoutPlan from "./SuggestedWorkoutPlan";
import TodayView from "./TodayView";
import WorkoutView from "./WorkoutView";
import { buildProgressivePlanForSplit, canonicalSplit, shouldShowSuggestedPlan, suggestedPlanDraftStorageKey, suggestedPlanHiddenStorageKey } from "./workoutPlan";
import { addSetToPlan, removeSetFromPlan, removeSetFromWorkouts, upsertSetInWorkouts } from "./workoutMutations";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { hasWorkoutActivity, toggleWorkoutType, workoutActivityFlag, workoutStageLabel, workoutStatusLabel, workoutTypeForEdit, workoutTypeLabel } from "./workoutDisplayUtils";

const DEFAULT_WORKOUT_TYPES = ["Push", "Pull", "Legs", "Cardio", "Sports", "Mobility"];
const DEFAULT_EXERCISES = {
  Push: ["Flat Dumbbell Bench Press", "Incline Dumbbell Press", "Dumbbell Shoulder Press", "Lateral Raise", "Triceps Rope Pushdown", "Push-ups"],
  Pull: ["Lat Pulldown", "Low Row", "Machine Rear Delt", "Bicep Curl", "Hammer Curl"],
  Legs: ["Leg Extension", "Goblet Squats", "Leg Curls", "Romanian Deadlift", "Calf Raise"],
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
  const [screen, setScreen] = useState(() => {
    const saved = localStorage.getItem("fitness-active-view");
    const savedScreen = createRootScreen(saved === "daily" || saved === "history" ? "history" : "today");
    return screenFromHistoryState(window.history.state) || savedScreen;
  });
  const activeView = screen.name === "history" ? "daily" : screen.name === "workout" ? "workout" : "dashboard";
  const [theme, setTheme] = useState(() => localStorage.getItem("fitness-theme") || "light");
  const [range, setRange] = useState(30);
  const [workouts, setWorkouts] = useState([]);
  const [bodyLogs, setBodyLogs] = useState([]);
  const [logDate, setLogDate] = useState(todayKey());
  const [workoutDate, setWorkoutDate] = useState(() => screen.name === "workout" ? screen.date : todayKey());
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [calendarMode, setCalendarMode] = useState(() => localStorage.getItem("fitness-calendar-mode") === "month" ? "month" : "week");
  const [historyFilter, setHistoryFilter] = useState(() => localStorage.getItem("fitness-history-filter") || "All");
  const [isHistoryCalendarOpen, setIsHistoryCalendarOpen] = useState(() => localStorage.getItem("fitness-history-calendar-open") === "true");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isWorkoutDatePickerOpen, setIsWorkoutDatePickerOpen] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({ name: "", trackingType: "weighted", sets: [{ reps: "10", weight: "", duration: "" }] });
  const [notice, setNotice] = useState("");
  const [exportFile, setExportFile] = useState(null);
  const [isExportOptionsOpen, setIsExportOptionsOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => dateKey(startOfMonth(new Date())).slice(0, 7));
  const workoutDateInputRef = useRef(null);
  const initialScreenRef = useRef(screen);

  useEffect(() => {
    window.history.replaceState(
      historyStateForScreen(initialScreenRef.current, window.history.state),
      ""
    );

    const handlePopState = (event) => {
      const previousScreen = screenFromHistoryState(event.state);
      if (!previousScreen) return;
      setScreen(previousScreen);
      if (previousScreen.name === "workout") setWorkoutDate(previousScreen.date);
      setIsWorkoutDatePickerOpen(false);
      setIsExportOptionsOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = useCallback((nextScreen, { replace = false } = {}) => {
    if (screensMatch(screen, nextScreen)) return;
    const nextState = historyStateForScreen(nextScreen, window.history.state);
    window.history[replace ? "replaceState" : "pushState"](nextState, "");
    setScreen(nextScreen);
  }, [screen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("fitness-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("fitness-calendar-mode", calendarMode);
  }, [calendarMode]);

  useEffect(() => {
    localStorage.setItem("fitness-history-filter", historyFilter);
    localStorage.setItem("fitness-history-calendar-open", String(isHistoryCalendarOpen));
  }, [historyFilter, isHistoryCalendarOpen]);

  useEffect(() => {
    localStorage.setItem("fitness-active-view", screenStorageValue(screen));
  }, [screen]);

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
        .select("id,user_id,log_date,weight")
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
    if (screen.name === "workout") {
      navigateTo(createWorkoutScreen(date, screen.returnTo), { replace: true });
    }
    setIsWorkoutDatePickerOpen(false);
  }

  function bestBefore(exerciseName, trackingType = "weighted", beforeDate = todayKey()) {
    let best = null;
    workouts.forEach((workout) => {
      if (workout.workout_date >= beforeDate) return;
      workout.exercises?.forEach((exercise) => {
        if (exercise.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") !== String(exerciseName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "")) return;
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

  async function acceptSuggestedPlan(planExercises) {
    const suggestions = planExercises
      .map((exercise) => ({
        ...exercise,
        name: exercise.name.trim(),
        trackingType: exercise.trackingType || "weighted",
        sets: exercise.sets.map((set) => normalizeSetInput(set, exercise.trackingType || "weighted")).filter(Boolean)
      }))
      .filter((exercise) => exercise.name && exercise.sets.length);
    if (!suggestions.length) return;

    setSaving(true);
    setNotice("");
    try {
      const workoutType = workoutTypeForEdit(selectedWorkout) || workoutTypeForEdit({ split: suggestions[0]?.split }) || "";
      const workout = await ensureWorkoutForDate(workoutDate, workoutType || undefined, { did_workout: true });

      for (const suggestion of suggestions) {
        const previous = bestBefore(suggestion.name, suggestion.trackingType, workoutDate);
        const { data: exercise, error: exerciseError } = await supabase
          .from("exercises")
          .insert({ workout_id: workout.id, user_id: userId, name: suggestion.name, tracking_type: suggestion.trackingType })
          .select("id,user_id,name,tracking_type,created_at")
          .single();
        if (exerciseError) throw exerciseError;

        const setRows = suggestion.sets.map((set) => ({
          exercise_id: exercise.id,
          user_id: userId,
          reps: set.reps,
          weight: set.weight,
          duration_minutes: set.duration_minutes,
          is_pr: Boolean(previous) && isBetterSet(set, previous, suggestion.trackingType)
        }));
        const { data: sets, error: setError } = await supabase
          .from("exercise_sets")
          .insert(setRows)
          .select("id,user_id,reps,weight,duration_minutes,is_pr,logged_at");
        if (setError) throw setError;

        setWorkouts((items) => upsertExercise(items, workout.id, { ...exercise, exercise_sets: sets }));
      }
      setNotice(suggestions.length === 1 ? `${suggestions[0].name} logged and removed from the plan.` : "Suggested exercises logged. You can still edit by deleting or adding exercises/sets.");
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStrengthSet({ date, split, exercise, set }) {
    const trackingType = exercise.trackingType || exercise.tracking_type || "weighted";
    const normalized = normalizeSetInput(set, trackingType);
    if (!normalized) return null;

    setSaving(true);
    setNotice("");
    try {
      const workout = await ensureWorkoutForDate(date, split, { did_workout: true });
      let persistedExercise = (workout.exercises || []).find(
        (item) => item.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") === exercise.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
      );

      if (!persistedExercise) {
        const { data, error } = await supabase
          .from("exercises")
          .insert({
            workout_id: workout.id,
            user_id: userId,
            name: exercise.name.trim(),
            tracking_type: trackingType
          })
          .select("id,user_id,name,tracking_type,created_at")
          .single();
        if (error) throw error;
        persistedExercise = { ...data, exercise_sets: [] };
      }

      const previous = bestBefore(exercise.name, trackingType, date);
      const payload = {
        ...normalized,
        is_pr: Boolean(previous) && isBetterSet(normalized, previous, trackingType)
      };
      const query = set.id
        ? supabase.from("exercise_sets").update(payload).eq("id", set.id)
        : supabase.from("exercise_sets").insert({
          exercise_id: persistedExercise.id,
          user_id: userId,
          ...payload
        });
      const { data: savedSet, error: setError } = await query
        .select("id,user_id,reps,weight,duration_minutes,is_pr,logged_at")
        .single();
      if (setError) throw setError;

      setWorkouts((items) => upsertSetInWorkouts(items, workout.id, persistedExercise, savedSet));
      return savedSet;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveTimedActivity({ date, name, duration, setId }) {
    const saved = await saveStrengthSet({
      date,
      split: name,
      exercise: { name, trackingType: "time" },
      set: { id: setId, duration }
    });
    return Boolean(saved);
  }

  async function clearWorkoutType(date) {
    setIsWorkoutDatePickerOpen(false);
    const workout = workouts.find((item) => item.workout_date === date);
    const hasSets = workout?.exercises?.some((exercise) => exercise.exercise_sets?.length);
    if (hasSets) {
      setNotice("Remove the logged sets before clearing this session.");
      return false;
    }
    try {
      await ensureWorkoutForDate(date, "", { did_workout: false });
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
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

  async function deleteSet(setId) {
    const setWorkoutDate = workouts.find((workout) => workout.exercises?.some((exercise) => exercise.exercise_sets?.some((set) => set.id === setId)))?.workout_date;
    if (isFutureDateKey(setWorkoutDate)) {
      setNotice(FUTURE_WORKOUT_NOTICE);
      setWorkoutDate(todayKey());
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("exercise_sets").delete().eq("id", setId);
    if (error) setNotice(error.message);
    else setWorkouts((items) => removeSetFromWorkouts(items, setId));
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

  async function saveWeightLog({ date, weight }) {
    const normalizedWeight = normalizeWeightInput(weight);
    if (!date || normalizedWeight === null) return false;
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase
      .from("body_logs")
      .upsert({
        user_id: userId,
        log_date: date,
        weight: normalizedWeight,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,log_date" })
      .select("id,user_id,log_date,weight")
      .single();

    if (error) setNotice(error.message);
    else {
      setBodyLogs((items) => [...items.filter((item) => item.log_date !== data.log_date), data].sort((a, b) => a.log_date.localeCompare(b.log_date)));
    }
    setSaving(false);
    return !error;
  }

  async function changeSplit(split) {
    setIsWorkoutDatePickerOpen(false);
    try {
      const nextSplit = workoutTypeLabel(split);
      await ensureWorkoutForDate(workoutDate, nextSplit, {
        did_workout: workoutActivityFlag(nextSplit, selectedWorkout)
      });
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function saveDailyLog({ date, steps }) {
    setSaving(true);
    setNotice("");
    try {
      const fields = {};
      if (steps !== undefined) {
        const normalizedSteps = steps === "" ? null : normalizeStepsInput(steps);
        if (steps !== "" && normalizedSteps === null) return false;
        fields.steps = normalizedSteps;
      }

      await ensureWorkoutForDate(date, undefined, fields);
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function downloadExport(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = exportFilename(payload);
    if (exportFile?.url) URL.revokeObjectURL(exportFile.url);
    setExportFile({ url, filename, label: payload.period.label });
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => link.remove(), 0);
    setNotice(`Export ready for ${payload.period.label}. If it did not download automatically, use the download link below.`);
    setIsExportOptionsOpen(false);
  }

  function exportSelectedMonth() {
    const [year, month] = exportMonth.split("-").map(Number);
    const payload = buildFitnessExport({
      mode: "month",
      month: new Date(year, month - 1, 1),
      workouts,
      bodyLogs,
      userId
    });
    downloadExport(payload);
  }

  function exportAllTimeData() {
    const payload = buildFitnessExport({
      mode: "all-time",
      workouts,
      bodyLogs,
      userId
    });
    downloadExport(payload);
  }

  const dateChipDate = activeView === "workout" ? workoutDate : todayKey();
  const dateChipLabel = new Date(`${dateChipDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="app-shell">
      <AppHeader
        screen={screen}
        theme={theme}
        isMenuOpen={isExportOptionsOpen}
        exportMonth={exportMonth}
        onExportMonthChange={setExportMonth}
        onOpenToday={() => navigateTo(createRootScreen("today"))}
        onOpenHistory={() => navigateTo(createRootScreen("history"))}
        onBack={() => window.history.back()}
        onToggleMenu={() => setIsExportOptionsOpen((open) => !open)}
        onToggleTheme={() => {
          setTheme((current) => current === "dark" ? "light" : "dark");
          setIsExportOptionsOpen(false);
        }}
        onExportMonth={exportSelectedMonth}
        onExportAll={exportAllTimeData}
      />

      <main className={`app view-frame view-${activeView}`}>
        {activeView !== "dashboard" ? (
          <section className="hero-row">
            <h1>{activeView === "daily" ? "History" : "Workout"}</h1>
            {activeView === "workout" ? (
              <div className="date-chip date-chip-picker">
                <button type="button" className="date-chip-trigger" onClick={() => setIsWorkoutDatePickerOpen((open) => !open)} aria-expanded={isWorkoutDatePickerOpen} aria-label="Change workout date" title="Change workout date">
                  <CalendarDays size={16} />
                  <span>{dateChipLabel}</span>
                </button>
                {isWorkoutDatePickerOpen ? (
                  <div className="date-popover">
                    <input ref={workoutDateInputRef} type="date" value={workoutDate} max={todayKey()} onInput={(event) => selectWorkoutDate(event.target.value)} onKeyDown={(event) => {
                      if (event.key === "Escape") setIsWorkoutDatePickerOpen(false);
                    }} aria-label="Workout date" />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

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
          <TodayView
            bodyLogs={bodyLogs}
            workouts={workouts}
            range={range}
            setRange={setRange}
            onSaveWeight={saveWeightLog}
            onSaveSteps={saveDailyLog}
            onOpenWorkout={(date) => {
              setWorkoutDate(date);
              navigateTo(createWorkoutScreen(date, "today"));
            }}
            saving={saving}
          />
        )}

        {!loading && activeView === "daily" && (
          <HistoryView
            workouts={workouts}
            bodyLogs={bodyLogs}
            filter={historyFilter}
            onFilterChange={setHistoryFilter}
            calendarOpen={isHistoryCalendarOpen}
            onCalendarOpenChange={setIsHistoryCalendarOpen}
            calendarMode={calendarMode}
            onCalendarModeChange={setCalendarMode}
            calendarMonth={calendarMonth}
            onCalendarMonthChange={setCalendarMonth}
            selectedDate={logDate}
            onSelectedDateChange={selectLogDate}
            onOpenWorkout={(date) => {
              setWorkoutDate(date);
              navigateTo(createWorkoutScreen(date, "history"));
            }}
          />
        )}

        {!loading && activeView === "workout" && (
          <WorkoutView
            date={workoutDate}
            readOnly={workoutDate !== todayKey()}
            selectedSplit={workoutTypeForEdit(selectedWorkout)}
            workout={selectedWorkout}
            workouts={workouts}
            workoutTypes={workoutTypes}
            saving={saving}
            onChangeType={changeSplit}
            onClearType={() => clearWorkoutType(workoutDate)}
            onSaveSet={saveStrengthSet}
            onSaveActivity={saveTimedActivity}
            onDeleteSet={deleteSet}
            onDeleteExercise={deleteExercise}
            exerciseForm={exerciseForm}
            setExerciseForm={setExerciseForm}
            isAddingExercise={isAddingExercise}
            setIsAddingExercise={setIsAddingExercise}
            addExercise={addExercise}
            exerciseNames={exerciseNames}
            selectedWorkout={selectedWorkout}
            saveDailyLog={saveDailyLog}
            bestBefore={bestBefore}
            repeatSet={repeatSet}
            deleteSet={deleteSet}
            deleteExercise={deleteExercise}
            acceptSuggestedPlan={acceptSuggestedPlan}
            saveStrengthSet={saveStrengthSet}
            saveTimedActivity={saveTimedActivity}
            clearWorkoutType={clearWorkoutType}
          />
        )}

      </main>
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
      <section className="log-navigator">
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

      <FocusStage className="log-focus">
        <span className="stage-label">{formatLongDate(selectedDate)}</span>
        <h2>Workout</h2>
        <DayWorkoutDetails workout={selectedLog} bodyLog={selectedBodyLog} />
      </FocusStage>
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
              <b>{workoutStatusLabel(log)}</b>
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
        <strong>Rest day</strong>
        <span>{bodyLog ? `${Number(bodyLog.weight).toFixed(1)} kg` : "No workout logged"}</span>
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

  const typeLabel = workoutTypeLabel(workout.split);
  return (
    <div className="day-detail">
      {typeLabel ? (
        <div className="day-summary">
          <strong>{typeLabel}</strong>
          <span>{dailyMeta(workout, bodyLog)}</span>
        </div>
      ) : <p className="day-meta">{dailyMeta(workout, bodyLog)}</p>}
      {workout.exercises?.length ? workout.exercises.map((exercise) => (
        <article className="mini-exercise" key={exercise.id}>
          <h3>{exercise.name}</h3>
          <div>
            {exercise.exercise_sets.map((set, index) => (
              <span key={set.id}>{index + 1}. {formatSet(set, exercise.tracking_type || "weighted")}{set.is_pr ? " PR" : ""}</span>
            ))}
          </div>
        </article>
      )) : <Empty text="Workout saved. No exercise sets logged yet." />}
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
            <span className="calendar-workout">{didWorkout ? workoutStatusLabel(log) : isSaved ? "Rest" : ""}</span>
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

function loadSuggestedPlanDraft(selectedDate, selectedSplit, workouts) {
  const fallback = buildProgressivePlanForSplit({
    split: selectedSplit,
    selectedDate,
    workouts
  });
  try {
    const stored = localStorage.getItem(suggestedPlanDraftStorageKey(selectedDate, selectedSplit));
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveSuggestedPlanDraft(selectedDate, selectedSplit, planDraft) {
  try {
    const key = suggestedPlanDraftStorageKey(selectedDate, selectedSplit);
    if (planDraft) localStorage.setItem(key, JSON.stringify(planDraft));
    else localStorage.removeItem(key);
  } catch {
    // Ignore storage errors; workout logging still works without draft persistence.
  }
}

function loadHiddenSplits(selectedDate) {
  try {
    const stored = localStorage.getItem(suggestedPlanHiddenStorageKey(selectedDate));
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function saveHiddenSplits(selectedDate, hiddenSplits) {
  try {
    const key = suggestedPlanHiddenStorageKey(selectedDate);
    const values = Array.from(hiddenSplits || []);
    if (values.length) localStorage.setItem(key, JSON.stringify(values));
    else localStorage.removeItem(key);
  } catch {
    // Ignore storage errors; hiding a suggested plan remains session-only.
  }
}

function LegacyWorkoutView({ selectedDate, selectedSplit, workouts, changeSplit, exerciseForm, setExerciseForm, isAddingExercise, setIsAddingExercise, addExercise, exerciseNames, workoutTypes, selectedWorkout, saveDailyLog, bestBefore, repeatSet, deleteSet, deleteExercise, acceptSuggestedPlan, saving }) {
  const [isEditingType, setIsEditingType] = useState(false);
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [typeDraft, setTypeDraft] = useState(selectedSplit);
  const [stepsDraft, setStepsDraft] = useState(selectedWorkout?.steps ?? "");
  const [planDraft, setPlanDraft] = useState(() => loadSuggestedPlanDraft(selectedDate, selectedSplit, workouts));
  const [hiddenSplits, setHiddenSplits] = useState(() => loadHiddenSplits(selectedDate));
  const workoutsRef = useRef(workouts);
  const planDraftStorageKeyRef = useRef(suggestedPlanDraftStorageKey(selectedDate, selectedSplit));
  const hiddenSplitsStorageKeyRef = useRef(suggestedPlanHiddenStorageKey(selectedDate));
  const existingExerciseNames = useMemo(() => new Set((selectedWorkout?.exercises || []).map((exercise) => exercise.name.toLowerCase())), [selectedWorkout?.exercises]);
  const selectedCanonicalSplit = canonicalSplit(selectedSplit);
  const isSuggestedPlanHidden = Boolean(selectedCanonicalSplit && hiddenSplits.has(selectedCanonicalSplit));
  const hasSuggestedPlan = Boolean(planDraft?.exercises?.length);
  const canRestoreSuggestedPlan = Boolean(selectedCanonicalSplit);
  const showSuggestedPlan = shouldShowSuggestedPlan({ plan: planDraft, selectedWorkout, hiddenSplits });

  useEffect(() => {
    setIsEditingType(false);
    setTypeDraft(selectedSplit);
  }, [selectedSplit]);

  useEffect(() => {
    setIsEditingSteps(false);
    setStepsDraft(selectedWorkout?.steps ?? "");
  }, [selectedDate, selectedWorkout?.steps]);

  useEffect(() => {
    workoutsRef.current = workouts;
  }, [workouts]);

  useEffect(() => {
    planDraftStorageKeyRef.current = suggestedPlanDraftStorageKey(selectedDate, selectedSplit);
    setPlanDraft(loadSuggestedPlanDraft(selectedDate, selectedSplit, workoutsRef.current));
  }, [selectedSplit, selectedDate]);

  useEffect(() => {
    hiddenSplitsStorageKeyRef.current = suggestedPlanHiddenStorageKey(selectedDate);
    setHiddenSplits(loadHiddenSplits(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (planDraftStorageKeyRef.current !== suggestedPlanDraftStorageKey(selectedDate, selectedSplit)) return;
    saveSuggestedPlanDraft(selectedDate, selectedSplit, planDraft);
  }, [selectedDate, selectedSplit, planDraft]);

  useEffect(() => {
    if (hiddenSplitsStorageKeyRef.current !== suggestedPlanHiddenStorageKey(selectedDate)) return;
    saveHiddenSplits(selectedDate, hiddenSplits);
  }, [selectedDate, hiddenSplits]);

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

  function updatePlanExercise(index, patch) {
    setPlanDraft((plan) => plan ? ({
      ...plan,
      exercises: plan.exercises.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, ...patch } : exercise)
    }) : plan);
  }

  function updatePlanSet(exerciseIndex, setIndex, field, value) {
    setPlanDraft((plan) => plan ? ({
      ...plan,
      exercises: plan.exercises.map((exercise, index) => index === exerciseIndex ? {
        ...exercise,
        sets: exercise.sets.map((set, rowIndex) => rowIndex === setIndex ? { ...set, [field]: value } : set)
      } : exercise)
    }) : plan);
  }

  function removePlanExercise(index) {
    setPlanDraft((plan) => plan ? ({ ...plan, exercises: plan.exercises.filter((_exercise, exerciseIndex) => exerciseIndex !== index) }) : plan);
  }

  function removePlanSet(exerciseIndex, setIndex) {
    setPlanDraft((plan) => removeSetFromPlan(plan, exerciseIndex, setIndex));
  }

  function addPlanSet(exerciseIndex) {
    setPlanDraft((plan) => addSetToPlan(plan, exerciseIndex));
  }

  function addPlanExercise() {
    setPlanDraft((plan) => plan ? ({
      ...plan,
      exercises: [...plan.exercises, { name: "", trackingType: "weighted", note: "", sets: [{ reps: "10", weight: "", duration: "" }] }]
    }) : plan);
  }

  function hidePlan() {
    const split = canonicalSplit(selectedSplit);
    if (split) setHiddenSplits((current) => new Set([...current, split]));
  }

  function showPlan() {
    const split = canonicalSplit(selectedSplit);
    if (!split) return;
    setHiddenSplits((current) => {
      const next = new Set(current);
      next.delete(split);
      return next;
    });
  }

  function resetSuggestions() {
    const split = canonicalSplit(selectedSplit);
    const resetPlan = buildProgressivePlanForSplit({
      split,
      selectedDate,
      workouts
    });
    if (!split || !resetPlan) return;
    setPlanDraft(resetPlan);
    setHiddenSplits((current) => {
      const next = new Set(current);
      next.delete(split);
      return next;
    });
  }

  async function acceptPlanExercise(index) {
    const exercise = planDraft?.exercises?.[index];
    if (!exercise) return;
    const accepted = await acceptSuggestedPlan([exercise]);
    if (accepted) {
      setPlanDraft((plan) => {
        if (!plan) return plan;
        const remainingExercises = plan.exercises.filter((_exercise, exerciseIndex) => exerciseIndex !== index);
        return remainingExercises.length ? { ...plan, exercises: remainingExercises } : null;
      });
    }
  }

  return (
    <>
      <FocusStage className="workout-focus form">
        <div className="daily-control-head">
          <div>
            <span className="stage-label">{selectedDate === todayKey() ? workoutStageLabel(selectedSplit, selectedWorkout) : formatLongDate(selectedDate)}</span>
            <h2 className="workout-title">{selectedSplit ? workoutTypeLabel(selectedSplit) : "Set workout type"}</h2>
          </div>
          {!isEditingType ? (
            <button type="button" className="focus-action" onClick={() => setIsEditingType(true)}>Edit</button>
          ) : null}
        </div>
        <div className="quick-split-buttons" aria-label="Quick workout templates">
          {["Push", "Pull", "Legs"].map((type) => {
            const isActive = selectedSplit?.toLowerCase() === type.toLowerCase();
            return (
              <button
                key={type}
                type="button"
                className={isActive ? "active" : ""}
                aria-pressed={isActive}
                onClick={() => changeSplit(toggleWorkoutType(selectedSplit, type))}
              >
                {type}
              </button>
            );
          })}
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
      </FocusStage>

      {showSuggestedPlan ? (
        <SuggestedWorkoutPlan
          plan={planDraft}
          existingExerciseNames={existingExerciseNames}
          exerciseNames={exerciseNames}
          formatDate={formatDate}
          updateExercise={updatePlanExercise}
          updateSet={updatePlanSet}
          addSet={addPlanSet}
          removeSet={removePlanSet}
          removeExercise={removePlanExercise}
          addExercise={addPlanExercise}
          acceptExercise={acceptPlanExercise}
          hidePlan={hidePlan}
          resetSuggestions={resetSuggestions}
          saving={saving}
        />
      ) : hasSuggestedPlan && isSuggestedPlanHidden ? (
        <section className="suggested-plan-toggle">
          <div>
            <strong>{planDraft.title}</strong>
            <span>Suggestions hidden</span>
          </div>
          <button type="button" className="secondary mini" onClick={showPlan}>Show</button>
        </section>
      ) : canRestoreSuggestedPlan ? (
        <section className="suggested-plan-toggle">
          <div>
            <strong>Suggested {selectedCanonicalSplit} Day</strong>
            <span>No suggestions remaining</span>
          </div>
          <button type="button" className="secondary mini" onClick={resetSuggestions}><RefreshCw size={14} />Reset</button>
        </section>
      ) : null}

      {isAddingExercise ? (
        <form className="panel-section form add-exercise-form" onSubmit={addExercise}>
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
        <section className="add-exercise-bar">
          <button type="button" className="primary add-exercise-toggle" onClick={() => setIsAddingExercise(true)}>
            <Plus size={18} />Add Exercise
          </button>
        </section>
      )}

      <section className="exercises-section">
        <h2>Exercises</h2>
        <div className="exercise-list">
          {selectedWorkout?.exercises?.length ? selectedWorkout.exercises.map((exercise) => {
            const trackingType = exercise.tracking_type || "weighted";
            const previous = bestBefore(exercise.name, trackingType, selectedDate);
            const prCount = exercise.exercise_sets.filter((set) => set.is_pr).length;
            return (
              <article className="exercise-card exercise-record" key={exercise.id}>
                <div className="exercise-head">
                  <div>
                    <h3>{exercise.name}</h3>
                    <p>{previous ? `Previous best: ${formatSet(previous, trackingType)} on ${formatDate(previous.date)}` : "No previous session yet"}</p>
                  </div>
                  {prCount ? <span className="badge">PR</span> : null}
                </div>
                <div className="sets" role="list" aria-label={`${exercise.name} sets`}>
                  {exercise.exercise_sets.map((set, index) => (
                    <div className="set-row" role="listitem" key={set.id}>
                      <span>{index + 1}</span>
                      <b>{formatSet(set, trackingType)}</b>
                      <em>{set.is_pr ? "NEW PR" : ""}</em>
                      <button type="button" className="danger icon-only set-delete-button" onClick={() => deleteSet(set.id)} disabled={saving} aria-label={`Delete set ${index + 1} from ${exercise.name}`} title={`Delete set ${index + 1}`}>
                        <Trash2 size={14} />
                      </button>
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

function dailyMeta(workout, bodyLog) {
  const parts = [];
  if (workout?.steps) parts.push(`${Number(workout.steps).toLocaleString()} steps`);
  else parts.push("No steps logged");
  if (bodyLog) {
    parts.push(`${Number(bodyLog.weight).toFixed(1)} kg`);
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
