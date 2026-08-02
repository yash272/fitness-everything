import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Dumbbell, Timer } from "lucide-react";
import { useMemo } from "react";
import { calendarActivityLabel, consistencySummary, formatDailySteps, historyCategory, periodProgress, weekHistoryItems } from "./historyUtils";
import { hasWorkoutActivity, workoutStatusLabel } from "./workoutDisplayUtils";

const FILTERS = ["All", "Push", "Pull", "Legs", "Activity"];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date) {
  const day = date.getDay() || 7;
  return addDays(date, -day + 1);
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function sessionMetric(workout) {
  const exercises = workout.exercises || [];
  const sets = exercises.reduce((sum, exercise) => sum + (exercise.exercise_sets?.length || 0), 0);
  const duration = exercises.reduce((sum, exercise) => (
    sum + (exercise.exercise_sets || []).reduce((setSum, set) => setSum + Number(set.duration_minutes || 0), 0)
  ), 0);
  if (duration) return `${duration} min`;
  if (sets) return `${exercises.length} exercises · ${sets} sets`;
  return "No exercise sets";
}

function dayCount(count) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

export default function HistoryView({
  workouts,
  bodyLogs,
  filter,
  onFilterChange,
  calendarOpen,
  onCalendarOpenChange,
  calendarMode,
  onCalendarModeChange,
  calendarMonth,
  onCalendarMonthChange,
  selectedDate,
  onSelectedDateChange,
  onOpenWorkout
}) {
  const weekItems = useMemo(() => weekHistoryItems(workouts, selectedDate, filter), [filter, selectedDate, workouts]);
  const consistency = useMemo(() => consistencySummary(workouts), [workouts]);
  const selectedDateObject = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const weekStart = useMemo(() => startOfWeek(selectedDateObject), [selectedDateObject]);
  const weekEnd = addDays(weekStart, 6);
  const periodStart = calendarMode === "week"
    ? dateKey(weekStart)
    : dateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
  const periodEnd = calendarMode === "week"
    ? dateKey(weekEnd)
    : dateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0));
  const progress = useMemo(
    () => periodProgress(workouts, periodStart, periodEnd),
    [periodEnd, periodStart, workouts]
  );
  const selectedWorkout = useMemo(
    () => workouts.find((workout) => workout.workout_date === selectedDate),
    [selectedDate, workouts]
  );

  function moveWeek(amount) {
    const next = addDays(weekStart, amount * 7);
    onSelectedDateChange(dateKey(next));
    onCalendarMonthChange(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function moveMonth(amount) {
    const next = addMonths(calendarMonth, amount);
    onCalendarMonthChange(next);
    onSelectedDateChange(dateKey(next));
  }

  return (
    <div className="history-view">
      <section className="history-summary">
        <div>
          <span>This week</span>
          <strong>{dayCount(consistency.week)}</strong>
        </div>
        <div>
          <span>This month</span>
          <strong>{dayCount(consistency.month)}</strong>
        </div>
        <button type="button" className={calendarOpen ? "active" : ""} onClick={() => onCalendarOpenChange(!calendarOpen)} aria-label="Toggle calendar" aria-expanded={calendarOpen}>
          <CalendarDays size={18} />
        </button>
      </section>

      {calendarOpen ? (
        <section className="history-calendar">
          <div className="history-calendar-head">
            <div>
              <span>{calendarMode === "week" ? "Weekly progress" : "Monthly progress"}</span>
              <strong>{calendarMode === "week"
                ? `${formatDate(dateKey(weekStart))} - ${formatDate(dateKey(weekEnd))}`
                : calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
            </div>
            <div className="history-calendar-actions">
              <div className="calendar-mode">
                <button type="button" className={calendarMode === "week" ? "active" : ""} onClick={() => onCalendarModeChange("week")} aria-label="Show week view"><CalendarDays size={15} /></button>
                <button type="button" className={calendarMode === "month" ? "active" : ""} onClick={() => onCalendarModeChange("month")} aria-label="Show month view"><CalendarRange size={15} /></button>
              </div>
              <button type="button" onClick={() => calendarMode === "week" ? moveWeek(-1) : moveMonth(-1)} aria-label={`Previous ${calendarMode}`}><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => calendarMode === "week" ? moveWeek(1) : moveMonth(1)} aria-label={`Next ${calendarMode}`}><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="history-period-summary">
            <div>
              <span>Workout days</span>
              <strong>{progress.workoutDays}</strong>
            </div>
          </div>

          {calendarMode === "week" ? (
            <WeekCalendar weekStart={weekStart} workouts={workouts} selectedDate={selectedDate} onSelect={onSelectedDateChange} />
          ) : (
            <MonthCalendar month={calendarMonth} workouts={workouts} bodyLogs={bodyLogs} selectedDate={selectedDate} onSelect={onSelectedDateChange} />
          )}

          <button type="button" className="open-calendar-day" onClick={() => onOpenWorkout(selectedDate)}>
            <span>{formatDate(selectedDate)} - <strong>{workoutStatusLabel(selectedWorkout)}</strong></span>
            <ChevronRight size={17} />
          </button>
        </section>
      ) : null}

      <div className="history-filters" aria-label="History filters">
        {FILTERS.map((item) => (
          <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => onFilterChange(item)}>
            {item}
          </button>
        ))}
      </div>

      <section className="history-list">
        <div className="history-list-head">
          <h2>Week activities</h2>
          <span>{formatDate(dateKey(weekStart))} - {formatDate(dateKey(weekEnd))}</span>
        </div>
        {weekItems.length ? weekItems.map(({ date, workout, category, label }) => (
          <button type="button" className="history-row" key={date} onClick={() => onOpenWorkout(date)}>
            <span className={`history-row-icon ${category.toLowerCase()}`}>
              {category === "Activity" ? <Timer size={17} /> : <Dumbbell size={17} />}
            </span>
            <span>
              <small>{formatDate(date)}</small>
              <strong>{category === "Rest" ? "Rest" : workoutStatusLabel(workout)}</strong>
              <em>{workout ? sessionMetric(workout) : "No activity logged"}</em>
            </span>
            <span className="history-row-meta">
              <b className={`activity-chip ${category.toLowerCase()}`}>{label}</b>
              {workout?.steps ? <b>{Number(workout.steps).toLocaleString()} steps</b> : null}
              <ChevronRight size={18} />
            </span>
          </button>
        )) : <div className="history-empty">No days match this filter.</div>}
      </section>

    </div>
  );
}

function WeekCalendar({ weekStart, workouts, selectedDate, onSelect }) {
  const byDate = new Map(workouts.map((workout) => [workout.workout_date, workout]));
  return (
    <div className="history-week">
      {Array.from({ length: 7 }, (_item, index) => addDays(weekStart, index)).map((date) => {
        const key = dateKey(date);
        const workout = byDate.get(key);
        return (
          <button type="button" key={key} className={`${selectedDate === key ? "selected" : ""} ${hasWorkoutActivity(workout) ? "trained" : ""}`} onClick={() => onSelect(key)}>
            <span>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
            <strong>{date.getDate()}</strong>
            <small>{formatDailySteps(workout?.steps)}</small>
            <em className={`calendar-activity ${historyCategory(workout).toLowerCase()}`}>{calendarActivityLabel(workout)}</em>
          </button>
        );
      })}
    </div>
  );
}

function MonthCalendar({ month, workouts, bodyLogs, selectedDate, onSelect }) {
  const workoutsByDate = new Map(workouts.map((workout) => [workout.workout_date, workout]));
  const bodyByDate = new Map(bodyLogs.map((entry) => [entry.log_date, entry]));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: leading + days }, (_item, index) => index < leading ? null : index - leading + 1);

  return (
    <>
      <div className="history-weekdays" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="history-month">
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
          const workout = workoutsByDate.get(key);
          const body = bodyByDate.get(key);
          return (
            <button type="button" key={key} className={`${selectedDate === key ? "selected" : ""} ${hasWorkoutActivity(workout) ? "trained" : ""}`} onClick={() => onSelect(key)}>
              <strong>{day}</strong>
              <span className={`calendar-activity ${historyCategory(workout).toLowerCase()}`}>{calendarActivityLabel(workout)}</span>
              <small>{formatDailySteps(workout?.steps)}</small>
              <small>{body ? Number(body.weight).toFixed(1) : ""}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
