# Focused Workout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Workout into a focused strength or activity session where a split immediately creates a five-exercise draft and each set can be edited, compared, and saved independently.

**Architecture:** A pure session-draft module derives the latest matching prior session and merges it with the existing estimated-strength progression targets. `App.jsx` owns Supabase mutations, while `StrengthSession` and `ActivitySession` own transient form state and disclosure behavior. Existing workout rows, exercises, and exercise sets remain the persistence model.

**Tech Stack:** React 18, Vite 5, plain CSS, Lucide React, Supabase, Node test runner.

## Global Constraints

- Preserve all existing data and use the current Supabase schema.
- Push, Pull, or Legs selection immediately produces five editable exercises.
- Use the latest earlier workout in the same category and show every matching prior set.
- Keep the Epley estimated-strength progression rule: below 12 reps add 2 reps; at 12 reps add 5 lb and target 7 reps.
- Save each set separately; do not require accepting an entire plan.
- The active exercise dominates, the next incomplete exercise opens after a set sequence completes, and users may work out of order.
- Do not add a rest timer.
- Show `New best` inline only for a newly logged best set.
- Cardio, Badminton, and custom activities collect duration only.
- Clearing an empty session type returns the day to Rest.
- Past and current dates are editable; future dates are blocked.

---

### Task 1: Session Draft Model

**Files:**
- Create: `src/sessionDraft.js`
- Create: `src/sessionDraft.test.js`
- Modify: `src/workoutPlan.js`

**Interfaces:**
- Produces: `buildStrengthSessionDraft({ split, selectedDate, workouts }): StrengthSessionDraft | null`
- Produces: `sessionDraftStorageKey(date: string, split: string): string`
- Produces: `findNextIncompleteExerciseIndex(exercises, currentIndex): number`
- Produces: `pairedSetRows(previousSets, currentSets): Array<{ previous, current }>`
- Consumes: `buildProgressivePlanForSplit({ split, selectedDate, workouts })`

- [ ] **Step 1: Write failing tests for latest same-split history, full prior sets, progressive targets, paired row padding, and next incomplete exercise**

```js
test("draft pairs every set from the latest matching prior session", () => {
  const draft = buildStrengthSessionDraft({
    split: "Push",
    selectedDate: "2026-07-29",
    workouts: fixtureWorkouts
  });
  assert.deepEqual(draft.exercises[0].previousSets, [
    { reps: 10, weight: 40 },
    { reps: 9, weight: 40 },
    { reps: 8, weight: 40 }
  ]);
  assert.equal(draft.exercises[0].sets[0].reps, "12");
});
```

- [ ] **Step 2: Run `node --test src/sessionDraft.test.js` and verify it fails because the module is absent**

- [ ] **Step 3: Implement the draft model**

Each exercise object must contain:

```js
{
  key: "flat-dumbbell-bench-press",
  name: "Flat Dumbbell Bench Press",
  trackingType: "weighted",
  previousDate: "2026-07-24",
  previousSets: [{ id, reps, weight, duration_minutes, is_pr }],
  sets: [{ id: null, reps: "12", weight: "40", duration: "", is_pr: false }],
  progression: { sourceDate, previousSet, kind, label }
}
```

Persist only unconfirmed draft input in local storage. Confirmed sets come from `workouts`, so reloading cannot duplicate them.

- [ ] **Step 4: Run `node --test src/sessionDraft.test.js` and `node src/workoutPlan.test.mjs`**

- [ ] **Step 5: Commit**

```bash
git add src/sessionDraft.js src/sessionDraft.test.js src/workoutPlan.js
git commit -m "feat: model focused strength session drafts"
```

### Task 2: Per-Set Persistence

**Files:**
- Modify: `src/workoutMutations.js`
- Modify: `src/workoutMutations.test.mjs`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `upsertSetInWorkouts(workouts, workoutId, exercise, set): Workout[]`
- Produces in `Tracker`: `saveStrengthSet({ date, split, exercise, set }): Promise<SavedSet | null>`
- Produces in `Tracker`: `saveTimedActivity({ date, name, duration }): Promise<boolean>`
- Produces in `Tracker`: `clearWorkoutType(date): Promise<boolean>`

- [ ] **Step 1: Add failing immutable-state tests for inserting a set into a new exercise and replacing an edited persisted set**

- [ ] **Step 2: Run `node src/workoutMutations.test.mjs` and verify the new helper assertions fail**

- [ ] **Step 3: Implement `upsertSetInWorkouts` and the three Tracker mutations**

`saveStrengthSet` must:

1. Call `ensureWorkoutForDate(date, split, { did_workout: true })`.
2. Reuse a matching exercise in that workout or insert it.
3. Insert a new `exercise_sets` row when `set.id` is absent, otherwise update that row.
4. Compute `is_pr` with the existing historical comparison.
5. Update local `workouts` and return the saved set.

`clearWorkoutType` must set `split: ""` and `did_workout: false` only when the selected workout has no exercise sets; otherwise it must return `false` and show a notice.

`saveTimedActivity` must create or reuse one `tracking_type: "time"` exercise and one duration set for the day.

- [ ] **Step 4: Run mutation tests and the full `npm test` suite**

- [ ] **Step 5: Commit**

```bash
git add src/workoutMutations.js src/workoutMutations.test.mjs src/App.jsx
git commit -m "feat: save workout sets independently"
```

### Task 3: Strength And Activity Screens

**Files:**
- Create: `src/StrengthSession.jsx`
- Create: `src/ActivitySession.jsx`
- Create: `src/WorkoutView.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Delete: `src/SuggestedWorkoutPlan.jsx`

**Interfaces:**
- `WorkoutView({ date, workout, workouts, workoutTypes, saving, onDateChange, onChangeType, onClearType, onSaveSet, onDeleteSet, onDeleteExercise, onSaveActivity })`
- `StrengthSession({ draft, persistedWorkout, saving, onSaveSet, onDeleteSet, onDeleteExercise })`
- `ActivitySession({ date, name, existingDuration, saving, onSave })`

- [ ] **Step 1: Add a source-level test that requires `Previous`, `Today`, and `New best` labels and rejects `SuggestedWorkoutPlan`, `Hide plan`, `Reset`, and steps markup**

- [ ] **Step 2: Run the source-level test and verify it fails against the old Workout screen**

- [ ] **Step 3: Build the focused Workout header and type selector**

The header contains a back action and a clickable date with `max={todayDateKey()}`. Push, Pull, and Legs are direct choices; a compact activity menu handles Cardio, Badminton, and custom values. Pressing the selected type clears it only when no sets exist.

- [ ] **Step 4: Build `StrengthSession`**

Render five exercise disclosures. The active exercise uses a two-column `Previous | Today` rail with one row per paired set, numeric weight/reps inputs, and a confirm icon per current row. Confirmed rows stay editable and save individually. On the final target row confirmation, open the next incomplete exercise unless the user already selected another one.

- [ ] **Step 5: Build `ActivitySession`**

Render the activity name, one minutes input, and inline save-on-Enter/blur behavior. Do not show strength controls, set comparisons, or a timer.

- [ ] **Step 6: Remove the old suggestion accordion, separate add-exercise form, steps controls, repeat-set action, and obsolete CSS**

Keep delete-set and delete-exercise actions available in restrained overflow controls. Preserve custom exercise names through a compact add-exercise command inside the strength session.

- [ ] **Step 7: Run the focused source test, `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 8: Commit**

```bash
git add src/StrengthSession.jsx src/ActivitySession.jsx src/WorkoutView.jsx src/App.jsx src/styles.css src/workoutSessionStyles.test.js
git rm src/SuggestedWorkoutPlan.jsx
git commit -m "feat: build the focused workout experience"
```

