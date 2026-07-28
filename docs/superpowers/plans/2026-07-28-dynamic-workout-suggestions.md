# Dynamic Workout Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate Push, Pull, and Legs prescriptions from the strongest recent matching exercise set, then present all five exercises in a compact one-open-at-a-time accordion.

**Architecture:** Keep progression math and history selection as pure functions in `workoutPlan.js`, with no browser or Supabase dependencies. `WorkoutView` supplies loaded history and owns versioned draft persistence, while a new `SuggestedWorkoutPlan.jsx` component owns accordion and overflow-menu interaction. Existing Supabase logging functions remain unchanged.

**Tech Stack:** React 18, Vite 5, plain CSS, Lucide React, Node assertions/tests, Supabase client

## Global Constraints

- Keep exactly five template exercises for Push, Pull, and Legs.
- Use the strongest valid weighted set by Epley estimated strength: `weight * (1 + reps / 30)`.
- Below 12 reps, keep weight and add 2 reps, capped at 12.
- At 12 or more reps, add 5 lb and reset to 7 reps.
- Generate three identical target sets from the calculated target.
- Search only earlier workouts in the same canonical workout category.
- Fall back to existing template targets when no matching exercise history exists.
- Keep Supabase tables and existing exercise logging behavior unchanged.
- Keep suggestion edits persisted across app-tab changes.
- Show all five collapsed exercise prescriptions on a 390 px viewport.
- Only one exercise may be expanded at a time.
- Keep Hide Plan in the header; place Reset Suggestions and Add Exercise in the overflow menu.
- Use existing Quiet Performance tokens and typography; add no gradient, nested cards, or looping motion.
- Preserve visible keyboard focus and reduced-motion behavior.

---

## File Structure

- Modify `src/workoutPlan.js`: pure progression, history selection, prescription formatting, and versioned draft-key helpers.
- Modify `src/workoutPlan.test.mjs`: deterministic progression and history-selection coverage.
- Create `src/SuggestedWorkoutPlan.jsx`: accordion rows, compact summary, editable expanded exercise, and header actions.
- Modify `src/App.jsx`: pass workout history, load/reset dynamic drafts, and replace the inline suggestion component.
- Modify `src/styles.css`: prescription-ledger, accordion, overflow-menu, responsive, and theme styles.
- Modify `README.md`: describe progressive workout suggestions.

---

### Task 1: Pure Progression Engine

**Files:**
- Modify: `src/workoutPlan.js`
- Test: `src/workoutPlan.test.mjs`

**Interfaces:**
- Consumes: workout objects shaped as `{ workout_date, split, exercises: [{ name, tracking_type, exercise_sets: [{ reps, weight }] }] }`
- Produces: `estimateSetStrength(set)`, `progressBestSet(set)`, `buildProgressivePlanForSplit({ split, selectedDate, workouts })`, and `formatSuggestedPrescription(exercise)`
- Produces exercise metadata shaped as `{ sourceDate, previousSet, kind, label }` under `exercise.progression`

- [ ] **Step 1: Add failing best-set and progression assertions**

Append fixtures and assertions to `src/workoutPlan.test.mjs`:

```js
import {
  buildProgressivePlanForSplit,
  estimateSetStrength,
  formatSuggestedPrescription,
  progressBestSet
} from "./workoutPlan.js";

assert.equal(estimateSetStrength({ weight: 40, reps: 12 }), 56);
assert.equal(Number(estimateSetStrength({ weight: 45, reps: 7 }).toFixed(1)), 55.5);

assert.deepEqual(progressBestSet({ weight: 40, reps: 10 }), {
  reps: "12",
  weight: "40",
  duration: "",
  kind: "reps",
  label: "+2 reps"
});

assert.deepEqual(progressBestSet({ weight: 40, reps: 12 }), {
  reps: "7",
  weight: "45",
  duration: "",
  kind: "weight",
  label: "+5 lb"
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
node src/workoutPlan.test.mjs
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement deterministic set scoring and progression**

Add to `src/workoutPlan.js`:

```js
export function estimateSetStrength(set) {
  const weight = Number(set?.weight);
  const reps = Number(set?.reps);
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

export function progressBestSet(set) {
  const weight = Number(set.weight);
  const reps = Number(set.reps);
  if (reps >= 12) {
    return {
      reps: "7",
      weight: String(weight + 5),
      duration: "",
      kind: "weight",
      label: "+5 lb"
    };
  }
  return {
    reps: String(Math.min(12, reps + 2)),
    weight: String(weight),
    duration: "",
    kind: "reps",
    label: "+2 reps"
  };
}
```

Use this comparator for ties:

```js
function compareWeightedSets(a, b) {
  const strengthDelta = estimateSetStrength(b) - estimateSetStrength(a);
  if (Math.abs(strengthDelta) > 1e-9) return strengthDelta;
  const weightDelta = Number(b.weight) - Number(a.weight);
  if (weightDelta) return weightDelta;
  return Number(b.reps) - Number(a.reps);
}
```

- [ ] **Step 4: Add failing history-selection assertions**

Add a history fixture containing:

```js
const history = [
  {
    workout_date: "2026-07-20",
    split: "Push",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [
        { weight: 40, reps: 12 },
        { weight: 45, reps: 7 }
      ]
    }]
  },
  {
    workout_date: "2026-07-25",
    split: "Pull",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [{ weight: 80, reps: 12 }]
    }]
  },
  {
    workout_date: "2026-07-30",
    split: "Push",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [{ weight: 100, reps: 12 }]
    }]
  }
];

const progressivePush = buildProgressivePlanForSplit({
  split: "Push",
  selectedDate: "2026-07-28",
  workouts: history
});

assert.equal(progressivePush.exercises.length, 5);
assert.deepEqual(progressivePush.exercises[0].sets, [
  { reps: "7", weight: "45", duration: "" },
  { reps: "7", weight: "45", duration: "" },
  { reps: "7", weight: "45", duration: "" }
]);
assert.deepEqual(progressivePush.exercises[0].progression, {
  sourceDate: "2026-07-20",
  previousSet: { reps: 12, weight: 40 },
  kind: "weight",
  label: "+5 lb"
});
assert.equal(progressivePush.exercises[1].progression.kind, "baseline");
```

This fixture proves category filtering, future-date filtering, estimated-strength ranking, exactly five exercises, and baseline fallback.

- [ ] **Step 5: Run the focused test and verify red**

Run:

```bash
node src/workoutPlan.test.mjs
```

Expected: FAIL because `buildProgressivePlanForSplit` is not implemented.

- [ ] **Step 6: Implement per-exercise history lookup**

Add:

```js
function normalizeExerciseName(name) {
  return String(name || "").trim().toLowerCase();
}

function validWeightedSets(exercise) {
  return (exercise?.exercise_sets || [])
    .filter((set) => estimateSetStrength(set) !== null)
    .slice()
    .sort(compareWeightedSets);
}

function findLatestExerciseHistory({ exerciseName, split, selectedDate, workouts }) {
  return workouts
    .filter((workout) => workout.workout_date < selectedDate && canonicalSplit(workout.split) === split)
    .slice()
    .sort((a, b) => b.workout_date.localeCompare(a.workout_date))
    .map((workout) => ({
      sourceDate: workout.workout_date,
      exercise: (workout.exercises || []).find(
        (candidate) => normalizeExerciseName(candidate.name) === normalizeExerciseName(exerciseName)
      )
    }))
    .find((entry) => validWeightedSets(entry.exercise).length);
}
```

Implement:

```js
export function buildProgressivePlanForSplit({ split, selectedDate, workouts = [] }) {
  const category = canonicalSplit(split);
  const plan = buildSuggestedPlanForSplit(category);
  if (!plan) return null;

  plan.exercises = plan.exercises.map((exercise) => {
    const history = findLatestExerciseHistory({
      exerciseName: exercise.name,
      split: category,
      selectedDate,
      workouts
    });
    if (!history) {
      return {
        ...exercise,
        progression: {
          sourceDate: null,
          previousSet: null,
          kind: "baseline",
          label: "Baseline"
        }
      };
    }

    const bestSet = validWeightedSets(history.exercise)[0];
    const next = progressBestSet(bestSet);
    const target = { reps: next.reps, weight: next.weight, duration: "" };
    return {
      ...exercise,
      sets: [structuredClone(target), structuredClone(target), structuredClone(target)],
      progression: {
        sourceDate: history.sourceDate,
        previousSet: { reps: Number(bestSet.reps), weight: Number(bestSet.weight) },
        kind: next.kind,
        label: next.label
      }
    };
  });

  const sourceDates = plan.exercises
    .map((exercise) => exercise.progression.sourceDate)
    .filter(Boolean)
    .sort();
  return { ...plan, sourceDate: sourceDates.at(-1) || null };
}
```

- [ ] **Step 7: Add and test compact prescription formatting**

Add assertions:

```js
assert.equal(formatSuggestedPrescription({
  sets: [
    { weight: "45", reps: "7" },
    { weight: "45", reps: "7" },
    { weight: "45", reps: "7" }
  ]
}), "3 x 45 lb x 7");

assert.equal(formatSuggestedPrescription({
  sets: [
    { weight: "45", reps: "7" },
    { weight: "45", reps: "8" }
  ]
}), "45x7 / 45x8");
```

Implement:

```js
export function formatSuggestedPrescription(exercise) {
  const sets = exercise?.sets || [];
  if (!sets.length) return "No target";
  const first = sets[0];
  const identical = sets.every(
    (set) => String(set.weight) === String(first.weight) && String(set.reps) === String(first.reps)
  );
  if (identical) return `${sets.length} x ${first.weight} lb x ${first.reps}`;
  return sets.map((set) => `${set.weight}x${set.reps}`).join(" / ");
}
```

- [ ] **Step 8: Run progression tests and full suite**

Run:

```bash
node src/workoutPlan.test.mjs
npm test
```

Expected: all assertions and tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/workoutPlan.js src/workoutPlan.test.mjs
git commit -m "feat: generate progressive workout targets"
```

---

### Task 2: Dynamic Draft Integration

**Files:**
- Modify: `src/workoutPlan.js`
- Modify: `src/workoutPlan.test.mjs`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `buildProgressivePlanForSplit({ split, selectedDate, workouts })` from Task 1
- Produces: versioned `suggestedPlanDraftStorageKey(date, split)` values and dynamic load/reset behavior in `WorkoutView`
- Extends `WorkoutView` props with `workouts`

- [ ] **Step 1: Write the failing versioned-key assertion**

Change the draft-key assertion in `src/workoutPlan.test.mjs` to:

```js
assert.equal(
  suggestedPlanDraftStorageKey("2026-07-21", "push"),
  "fitness-suggested-plan-draft-v2:2026-07-21:Push"
);
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
node src/workoutPlan.test.mjs
```

Expected: FAIL because the current key omits `-v2`.

- [ ] **Step 3: Version the draft key**

Update:

```js
export function suggestedPlanDraftStorageKey(date, split) {
  return `fitness-suggested-plan-draft-v2:${date}:${canonicalSplit(split) || "none"}`;
}
```

Run the focused test and confirm it passes.

- [ ] **Step 4: Pass workout history into `WorkoutView`**

At the `WorkoutView` call in `Tracker`, add:

```jsx
workouts={workouts}
```

Update the component signature:

```jsx
function WorkoutView({
  selectedDate,
  selectedSplit,
  workouts,
  changeSplit,
  exerciseForm,
  setExerciseForm,
  isAddingExercise,
  setIsAddingExercise,
  addExercise,
  exerciseNames,
  workoutTypes,
  selectedWorkout,
  saveDailyLog,
  bestBefore,
  repeatSet,
  deleteSet,
  deleteExercise,
  acceptSuggestedPlan,
  saving
}) {
```

- [ ] **Step 5: Replace static fallback loading**

Import `buildProgressivePlanForSplit` from `workoutPlan.js`.

Change:

```js
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
```

Update the initial state and selected date/split effect to pass `workouts`. Do not add `workouts` to that effect dependency list; accepted exercises update the loaded history, and a history dependency would overwrite the in-progress draft. A new date or split intentionally recalculates.

- [ ] **Step 6: Make Reset rebuild dynamic targets**

Replace the static restore call in `showOriginalPlan`:

```js
const originalPlan = buildProgressivePlanForSplit({
  split,
  selectedDate,
  workouts
});
```

Rename the local handler and child prop from `showOriginalPlan` to `resetSuggestions` so interface copy and behavior agree.

- [ ] **Step 7: Run automated checks**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/workoutPlan.js src/workoutPlan.test.mjs
git commit -m "feat: load dynamic workout suggestion drafts"
```

---

### Task 3: Compact Accordion Component

**Files:**
- Create: `src/SuggestedWorkoutPlan.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: plan exercises with `progression` metadata and `formatSuggestedPrescription(exercise)`
- Consumes callbacks: `updateExercise`, `updateSet`, `addSet`, `removeSet`, `removeExercise`, `addExercise`, `acceptExercise`, `hidePlan`, `resetSuggestions`
- Produces: a five-row accordion with one expanded row and a header overflow menu

- [ ] **Step 1: Extract the component with unchanged behavior**

Move the existing inline `SuggestedWorkoutPlan` function from `App.jsx` into `src/SuggestedWorkoutPlan.jsx`. Import:

```jsx
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Dumbbell,
  Ellipsis,
  EyeOff,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import { formatSuggestedPrescription } from "./workoutPlan";
```

Export with an explicit prop contract:

```jsx
export default function SuggestedWorkoutPlan({
  plan,
  existingExerciseNames,
  exerciseNames,
  formatDate,
  updateExercise,
  updateSet,
  addSet,
  removeSet,
  removeExercise,
  addExercise,
  acceptExercise,
  hidePlan,
  resetSuggestions,
  saving
}) {
```

Immediately after that declaration, move the current `canLogExercise` declaration
and complete return tree from the inline component, then remove the original
function from `App.jsx`. Pass the existing `formatDate` function through the new
prop and rename the `showOriginalPlan` prop to `resetSuggestions`. Run lint and
build before changing layout.

- [ ] **Step 2: Add accordion and menu state**

At the top of the component:

```jsx
const [expandedIndex, setExpandedIndex] = useState(null);
const [isMenuOpen, setIsMenuOpen] = useState(false);
const menuRef = useRef(null);

useEffect(() => {
  if (expandedIndex !== null && expandedIndex >= plan.exercises.length) {
    setExpandedIndex(null);
  }
}, [expandedIndex, plan.exercises.length]);

useEffect(() => {
  if (!isMenuOpen) return undefined;
  const closeOnOutsidePointer = (event) => {
    if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
  };
  document.addEventListener("pointerdown", closeOnOutsidePointer);
  return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
}, [isMenuOpen]);
```

- [ ] **Step 3: Build the compact header**

Replace the current heading and bottom action strip with:

```jsx
<header className="suggestion-header">
  <div>
    <span className="stage-label">Next session</span>
    <h2>{plan.title.replace("Suggested ", "").replace(" Day", " progression")}</h2>
    <p>
      {plan.sourceDate ? `Latest source ${formatDate(plan.sourceDate)}` : "Starting targets"}
      {" - "}{plan.exercises.length} movements
    </p>
  </div>
  <div className="suggestion-header-actions">
    <button
      type="button"
      className="icon-button"
      onClick={hidePlan}
      aria-label="Hide suggestions"
      title="Hide suggestions"
    >
      <EyeOff size={17} />
    </button>
    <div className="suggestion-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="icon-button"
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-label="Suggestion options"
        aria-expanded={isMenuOpen}
        title="Suggestion options"
      >
        <Ellipsis size={18} />
      </button>
      {isMenuOpen ? (
        <div className="suggestion-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => {
            addExercise();
            setIsMenuOpen(false);
          }}>
            <Plus size={16} />Add exercise
          </button>
          <button type="button" role="menuitem" onClick={() => {
            resetSuggestions();
            setExpandedIndex(null);
            setIsMenuOpen(false);
          }}>
            <RefreshCw size={16} />Reset suggestions
          </button>
        </div>
      ) : null}
    </div>
  </div>
</header>
```

Pass a `formatDate` callback from `App.jsx`, or export the existing formatter from a focused date utility. Prefer the callback to avoid unrelated refactoring.

- [ ] **Step 4: Build collapsed prescription rows**

For each exercise, render:

```jsx
const isExpanded = expandedIndex === exerciseIndex;
const alreadyLogged = existingExerciseNames.has(exercise.name.toLowerCase());

<article
  className={`suggestion-row ${isExpanded ? "expanded" : ""} ${alreadyLogged ? "already-logged" : ""}`}
  key={`${exercise.name || "new"}-${exerciseIndex}`}
>
  <button
    type="button"
    className="suggestion-summary"
    onClick={() => setExpandedIndex(isExpanded ? null : exerciseIndex)}
    aria-expanded={isExpanded}
  >
    <span className="suggestion-name">
      <strong>{exercise.name || "New exercise"}</strong>
      <small>
        {exercise.progression?.sourceDate
          ? `Previous ${exercise.progression.previousSet.weight}x${exercise.progression.previousSet.reps}`
          : "Template starting point"}
      </small>
    </span>
    <b className="suggestion-prescription">{formatSuggestedPrescription(exercise)}</b>
    <span className={`progression-tag ${exercise.progression?.kind || "baseline"}`}>
      {exercise.progression?.label || "Baseline"}
    </span>
    <ChevronDown className="suggestion-chevron" size={17} aria-hidden="true" />
  </button>
  {isExpanded ? (
    <div className="suggestion-editor">
      <div className="suggested-exercise-head">
        <label>
          Exercise
          <input
            value={exercise.name}
            list="suggested-exercise-options"
            placeholder="Exercise name"
            onChange={(event) =>
              updateExercise(exerciseIndex, { name: event.target.value })
            }
          />
        </label>
        <button
          type="button"
          className="danger icon-only"
          onClick={() => removeExercise(exerciseIndex)}
          disabled={plan.exercises.length === 1}
          aria-label={`Remove ${exercise.name || "exercise"}`}
          title={`Remove ${exercise.name || "exercise"}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="target-set-grid">
        {exercise.sets.map((set, setIndex) => (
          <div className="target-set-row" key={setIndex}>
            <span>{setIndex + 1}</span>
            <label>
              Reps
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={set.reps}
                onChange={(event) =>
                  updateSet(exerciseIndex, setIndex, "reps", event.target.value)
                }
              />
            </label>
            <label>
              Lbs
              <input
                type="number"
                min="0"
                step="2.5"
                inputMode="decimal"
                value={set.weight}
                onChange={(event) =>
                  updateSet(exerciseIndex, setIndex, "weight", event.target.value)
                }
              />
            </label>
            <button
              type="button"
              className="danger icon-only"
              onClick={() => removeSet(exerciseIndex, setIndex)}
              disabled={exercise.sets.length === 1}
              aria-label={`Remove target set ${setIndex + 1} from ${exercise.name || "exercise"}`}
              title={`Remove target set ${setIndex + 1}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="secondary suggested-add-set"
        onClick={() => addSet(exerciseIndex)}
        disabled={saving}
      >
        <Plus size={16} />Add set
      </button>
      {exercise.note || alreadyLogged ? (
        <p className="suggested-note">
          {alreadyLogged
            ? "Already logged today. Logging this will add another copy. "
            : ""}
          {exercise.note}
        </p>
      ) : null}
      <div className="suggested-exercise-actions">
        <button
          type="button"
          className="primary"
          onClick={() => acceptExercise(exerciseIndex)}
          disabled={saving || !canLogExercise(exercise)}
        >
          <Dumbbell size={17} />Log exercise
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => removeExercise(exerciseIndex)}
          disabled={saving}
        >
          Skip
        </button>
      </div>
    </div>
  ) : null}
</article>
```

Keep the callback behavior shown above so the visual extraction does not change
logging, set editing, or removal behavior.

- [ ] **Step 5: Compact hidden and empty recovery panels**

Replace the current two-action hidden panel with a single compact row:

```jsx
<section className="suggested-plan-toggle">
  <div>
    <strong>{planDraft.title}</strong>
    <span>Suggestions hidden</span>
  </div>
  <button type="button" className="secondary mini" onClick={showPlan}>
    Show
  </button>
</section>
```

Replace the empty panel with the same compact structure and one Reset button that
calls `showOriginalPlan`. This keeps recovery available without restoring the old
stack of Hide, Reset, and Show controls.

- [ ] **Step 6: Replace suggestion CSS with ledger styling**

Remove obsolete `.suggested-plan-list`, `.suggested-exercise`, `.suggested-plan-actions`, and related nested-card rules.

Add:

```css
.suggested-plan {
  position: relative;
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.suggestion-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.suggestion-header p {
  margin-top: 4px;
  color: var(--faint);
  font-size: 0.76rem;
}

.suggestion-header-actions {
  display: flex;
  gap: 6px;
}

.suggestion-menu-wrap {
  position: relative;
}

.suggestion-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: grid;
  width: 190px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 4px;
  background: var(--surface-strong);
  box-shadow: var(--shadow-pop);
}

.suggestion-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  border-radius: 5px;
  padding: 0 10px;
  background: transparent;
  color: var(--text);
  text-align: left;
}

.suggestion-ledger {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.suggestion-row {
  border-bottom: 1px solid var(--line-soft);
}

.suggestion-row:last-child {
  border-bottom: 0;
}

.suggestion-summary {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(120px, 0.85fr) auto 20px;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 62px;
  padding: 9px 6px;
  background: transparent;
  color: var(--text);
  text-align: left;
}

.suggestion-name {
  min-width: 0;
}

.suggestion-name strong,
.suggestion-name small {
  display: block;
}

.suggestion-name strong {
  font-size: 0.86rem;
}

.suggestion-name small {
  margin-top: 3px;
  color: var(--faint);
  font-size: 0.68rem;
}

.suggestion-prescription {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.74rem;
  font-weight: 600;
  text-align: right;
}

.progression-tag {
  color: var(--accent-text);
  font-size: 0.68rem;
  font-weight: 650;
  white-space: nowrap;
}

.progression-tag.baseline {
  color: var(--faint);
}

.suggestion-chevron {
  color: var(--faint);
  transition: transform 170ms ease;
}

.suggestion-row.expanded .suggestion-chevron {
  transform: rotate(180deg);
}

.suggestion-editor {
  display: grid;
  gap: 10px;
  border-left: 2px solid var(--accent);
  padding: 4px 8px 14px 12px;
  animation: suggestion-editor-enter 170ms ease-out;
}

@keyframes suggestion-editor-enter {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Add a mobile rule:

```css
@media (max-width: 520px) {
  .suggestion-summary {
    grid-template-columns: minmax(0, 1fr) auto 18px;
    grid-template-areas:
      "name tag chevron"
      "target target chevron";
    gap: 5px 8px;
    min-height: 68px;
  }

  .suggestion-name {
    grid-area: name;
  }

  .suggestion-prescription {
    grid-area: target;
    text-align: left;
  }

  .progression-tag {
    grid-area: tag;
  }

  .suggestion-chevron {
    grid-area: chevron;
  }
}
```

- [ ] **Step 7: Run automated checks**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands pass with no duplicate CSS selector conflicts or React hook warnings.

- [ ] **Step 8: Commit**

```bash
git add src/SuggestedWorkoutPlan.jsx src/App.jsx src/styles.css
git commit -m "style: compact workout suggestions into accordion"
```

---

### Task 4: Responsive And Interaction Verification

**Files:**
- Modify: `src/SuggestedWorkoutPlan.jsx` only for accessibility or interaction fixes found during verification
- Modify: `src/styles.css` only for responsive or contrast fixes found during verification
- Modify: `README.md`

**Interfaces:**
- Consumes: completed progressive plan and accordion
- Produces: verified mobile, tablet, and desktop suggestion experience in both themes

- [ ] **Step 1: Update feature documentation**

Change the relevant README feature bullet to:

```markdown
- Dynamic Push, Pull, and Legs suggestions based on your strongest recent matching exercise set
```

- [ ] **Step 2: Verify mobile at 390 x 844**

In light and dark themes, confirm:

- all five collapsed exercise rows are visible before any editor is opened;
- long names wrap without overlapping target or progression text;
- tapping a row opens it and closes the previously open row;
- the expanded set inputs remain usable without horizontal scrolling;
- Hide Suggestions remains in the header;
- the overflow menu contains Add Exercise and Reset Suggestions;
- the menu closes after an action and outside interaction;
- the selected workout date and bottom navigation remain visible and coherent;
- no unwanted blue touch outline appears.

- [ ] **Step 3: Verify tablet at 768 x 1024**

Confirm the ledger uses the wider four-column summary layout, the menu stays inside the viewport, and the expanded editor does not stretch inputs beyond the 920 px Workout content constraint.

- [ ] **Step 4: Verify desktop at 1440 x 900**

Confirm all five collapsed rows fit comfortably, header actions are keyboard reachable, the overflow menu aligns to the right edge, and the expanded editor preserves the restrained one-column workflow.

- [ ] **Step 5: Verify progression examples in the live app**

Inspect at least one exercise with history and confirm:

- the row shows the prior best and source date;
- `40 x 10` style history displays a same-weight target with up to 12 reps;
- `40 x 12` style history displays a `+5 lb`, 7-rep target;
- exercises with no matching history show `Baseline`.

Do not submit or delete user workout data during visual verification.

- [ ] **Step 6: Inspect accessibility and console**

Confirm:

- summary buttons expose `aria-expanded`;
- the options button exposes `aria-expanded`;
- Hide and menu actions have accessible names and titles;
- visible keyboard focus remains;
- reduced motion reduces accordion animation;
- browser console has no warnings or errors.

- [ ] **Step 7: Run final verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Expected: tests, lint, build, and diff check pass; only intended files are changed.

- [ ] **Step 8: Commit**

```bash
git add README.md src/SuggestedWorkoutPlan.jsx src/App.jsx src/styles.css
git commit -m "docs: describe progressive workout suggestions"
```
